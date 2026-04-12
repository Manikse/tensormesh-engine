import os
import json
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from metrics.graph_math import CyclomaticComplexity

class VestaAST:
    """
    Deterministic syntax parser for Next.js / React architectures.
    Scans the directory, extracts functional components, and generates a complexity matrix.
    """
    def __init__(self, target_directory: str):
        self.target_directory = target_directory
        self.architecture_matrix = []

    def _scan_directory(self) -> list:
        target_files = []
        for root, _, files in os.walk(self.target_directory):
            if 'node_modules' in root or '.next' in root:
                continue
            for file in files:
                if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                    target_files.append(os.path.join(root, file))
        return target_files

    def compile_matrix(self, output_path: str = "vesta_matrix.json"):
        """
        Executes the AST parsing and mathematical complexity calculation.
        """
        files = self._scan_directory()
        total_complexity = 0
        
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    source_code = f.read()
                    
                mccabe_score = CyclomaticComplexity.calculate_mccabe(source_code)
                total_complexity += mccabe_score
                
                self.architecture_matrix.append({
                    "file": os.path.relpath(file_path, self.target_directory),
                    "cyclomatic_complexity": mccabe_score,
                    "status": "Warning: High refactor probability" if mccabe_score > 15 else "Stable"
                })
            except Exception as e:
                print(f"[ERROR] Failed to parse {file_path}: {e}")

        payload = {
            "engine": "Vesta-AST Deterministic Analyzer",
            "scanned_files": len(files),
            "system_complexity_index": total_complexity,
            "component_matrix": self.architecture_matrix
        }

        with open(output_path, 'w', encoding='utf-8') as out:
            json.dump(payload, out, indent=2)
            
        print(f"[VESTA-AST] Execution complete. Matrix saved to {output_path}")

if __name__ == "__main__":
    # Point this to your target Next.js application directory
    target_dir = "./src" if os.path.exists("./src") else "."
    analyzer = VestaAST(target_dir)
    analyzer.compile_matrix()