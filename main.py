import os
import asyncio
import logging
from dotenv import load_dotenv

# Aiogram
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart
from aiogram.utils.keyboard import InlineKeyboardBuilder

# Supabase
from supabase import create_client, Client

# Налаштування
logging.basicConfig(level=logging.INFO)
load_dotenv()

# --- КОНФІГУРАЦІЯ ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Твоє нове посилання на додаток
WEB_APP_URL = "https://vesta-music-bot-git-main-manikses-projects.vercel.app"

# Ініціалізація
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- ОБРОБНИК СТАРТУ ---
@dp.message(CommandStart())
async def start_cmd(message: types.Message):
    user = message.from_user
    args = message.text.split()
    
    # 1. РЕЄСТРАЦІЯ ЮЗЕРА
    try:
        supabase.table("profiles").upsert({
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            # Оновлюємо дату останнього входу, якщо треба
            "last_sync": "now()" 
        }).execute()
    except Exception as e:
        logging.error(f"Помилка реєстрації профілю: {e}")

    # 2. ЛОГІКА ЗАПРОШЕННЯ ДРУЗІВ
    # Перевіряємо, чи є аргумент (наприклад, /start friend_12345)
    if len(args) > 1 and args[1].startswith("friend_"):
        try:
            inviter_id = int(args[1].split("_")[1])
            
            # Не можна додати самого себе
            if inviter_id != user.id:
                # Додаємо зв'язок: Ти -> Друг
                supabase.table("friends").upsert(
                    {"user_id": user.id, "friend_id": inviter_id}, on_conflict="user_id, friend_id"
                ).execute()
                
                # Додаємо зв'язок: Друг -> Ти (Взаємно)
                supabase.table("friends").upsert(
                    {"user_id": inviter_id, "friend_id": user.id}, on_conflict="user_id, friend_id"
                ).execute()
                
                await message.answer("🤝 Ви тепер друзі у Vesta Music! Ваші плейлисти синхронізовані.")
                
                # Повідомляємо того, хто запросив
                try:
                    await bot.send_message(inviter_id, f"👋 {user.first_name} прийняв твоє запрошення і тепер у списку друзів!")
                except:
                    pass # Якщо бот заблокований запрошуючим
                    
        except Exception as e:
            logging.error(f"Помилка додавання друга: {e}")

    # 3. КЛАВІАТУРА
    builder = InlineKeyboardBuilder()
    
    # Кнопка відкриття Web App
    builder.row(types.InlineKeyboardButton(
        text="📀 Відкрити Vesta Music", 
        web_app=types.WebAppInfo(url=WEB_APP_URL))
    )
    
    # Кнопка запрошення (генерує посилання для шерингу)
    invite_link = f"https://t.me/{ (await bot.get_me()).username }?start=friend_{user.id}"
    
    builder.row(types.InlineKeyboardButton(
        text="🔗 Надіслати запрошення", 
        switch_inline_query=f"Приєднуйся до Vesta! 👇")
    )
    
    await message.answer(
        f"Привіт, {user.first_name}! 👋\n\n"
        "<b>Vesta Music</b> — це твій соціальний плеєр.\n"
        "Слухай музику, ділися плейлистами та дивись, що слухають друзі.\n\n"
        f"Твоє посилання для друзів:\n<code>{invite_link}</code>",
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )

# --- ЗАПУСК ---
async def main():
    print("🚀 Vesta Bot запущено!")
    await dp.start_polling(bot)

if __name__ == '__main__':
    asyncio.run(main())