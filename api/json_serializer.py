import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.stream_engine import TensorStreamer

class MeshAPI:
    @staticmethod
    def process_and_serialize(file_path: str, output_path: str):
        try:
            print("[ENGINE] Initiating O(1) streaming matrix analysis...")
            analysis_results = TensorStreamer.analyze_mesh(file_path)
            
            payload = {
                "metadata": {
                    "source_file": file_path,
                    "triangle_count": analysis_results["triangle_count"]
                },
                "structural_analysis": {
                    "volume_mm3": analysis_results["volume_mm3"],
                    "surface_area_mm2": analysis_results["surface_area_mm2"]
                },
                "architecture_specs": {
                    "memory_complexity": "O(1)",
                    "execution_passes": 1
                },
                "status": "compiled"
            }

            with open(output_path, 'w') as json_file:
                json.dump(payload, json_file, indent=2)
                
            print(f"✅ Success. Payload serialized to {output_path}")
            return payload
            
        except Exception as e:
            print(f"❌ Execution Error: {str(e)}")

if __name__ == "__main__":
    test_file = "sample_mesh.stl"
    output_file = "mesh_matrix.json"
    MeshAPI.process_and_serialize(test_file, output_file)