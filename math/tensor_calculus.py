class TensorCalculus:
    """
    Executes deterministic structural calculations on spatial data matrices.
    """
    @staticmethod
    def calculate_volume(triangles: list) -> float:
        """
        Computes exact volume using the signed volume of tetrahedra algorithm.
        V = (1/6) * |a * (b x c)|
        """
        total_volume = 0.0
        
        for tri in triangles:
            v1, v2, v3 = tri["vertices"]
            
            # Cross product of v2 and v3
            cross_x = v2[1] * v3[2] - v2[2] * v3[1]
            cross_y = v2[2] * v3[0] - v2[0] * v3[2]
            cross_z = v2[0] * v3[1] - v2[1] * v3[0]
            
            # Dot product of v1 and the cross product
            dot_product = v1[0] * cross_x + v1[1] * cross_y + v1[2] * cross_z
            
            total_volume += dot_product / 6.0
            
        return abs(total_volume)

    @staticmethod
    def calculate_surface_area(triangles: list) -> float:
        """
        Computes total surface area by integrating the magnitude of cross products.
        """
        total_area = 0.0
        
        for tri in triangles:
            v1, v2, v3 = tri["vertices"]
            
            # Vector AB (v2 - v1)
            ab = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]]
            # Vector AC (v3 - v1)
            ac = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]]
            
            # Cross product
            cross_x = ab[1] * ac[2] - ab[2] * ac[1]
            cross_y = ab[2] * ac[0] - ab[0] * ac[2]
            cross_z = ab[0] * ac[1] - ab[1] * ac[0]
            
            # Area of triangle is half the magnitude of the cross product
            area = 0.5 * ((cross_x**2 + cross_y**2 + cross_z**2)**0.5)
            total_area += area
            
        return total_area