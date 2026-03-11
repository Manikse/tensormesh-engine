import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.binary_decoder import BinaryMeshDecoder
from math.tensor_calculus import TensorCalculus

class MeshSerializer:
    """
    Compresses spatial calculations into a standardized JSON payload.
    Optimized for ingestion by Next.js and React-Three-Fiber environments.
    """
    @staticmethod
    def serialize_mesh(file_path: str, output_path: str):
        decoder = BinaryMeshDecoder(file_path)
        try:
            triangles = decoder.decode()
        except Exception as e:
            return {"status": "error", "message": str(e)}

        volume = TensorCalculus.calculate_volume(triangles)
        surface_area = TensorCalculus.calculate_surface_area(triangles)
        triangle_count = len(triangles)

        payload = {
            "metadata": {
                "source_file": file_path,
                "node_count": triangle_count * 3,
                "triangle_count": triangle_count
            },
            "structural_analysis": {
                "volume_mm3": round(volume, 4),
                "surface_area_mm2": round(surface_area, 4)
            },
            "status": "compiled"
        }

        with open(output_path, 'w') as json_file:
            json.dump(payload, json_file, indent=2)
            
        print(f"[SERIALIZER] Output compiled and routed to {output_path}")
        return payload

if __name__ == "__main__":
    # Test execution
    test_file = "sample_mesh.stl"
    output_file = "mesh_matrix.json"
    
    if not os.path.exists(test_file):
        print(f"Bypassing execution: Required binary input '{test_file}' not detected.")
    else:
        MeshSerializer.serialize_mesh(test_file, output_file)