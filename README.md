# TensorMesh Engine

TensorMesh is a zero-dependency, mathematically rigorous Python engine designed to parse, analyze, and serialize spatial engineering data (binary `.stl` matrices) for modern web environments. 

Instead of relying on bloated 3D libraries, TensorMesh extracts the raw geometric matrices, performs deterministic structural calculations, and outputs a highly optimized JSON payload ready for Next.js and Three.js consumption.

## Architectural Capabilities
* Binary Spatial Parsing: Directly reads and decodes binary `.stl` streams into memory-efficient float arrays, bypassing high-overhead abstraction layers.
* Deterministic Volume Integration: Calculates the exact volume of complex 3D meshes using the signed volume of tetrahedra algorithm: $V = \frac{1}{6} | \vec{a} \cdot (\vec{b} \times \vec{c}) |$.
* Surface Area Computation: Integrates the magnitude of cross products across all geometric faces.
* Web-Ready Serialization: Compresses structural parameters into a standardized JSON schema specifically structured for high-performance React architectures.

## Tech Stack
* Core Engine: Python (Pure mathematical implementation, no third-party overhead)
* Target Integration: Next.js, React-Three-Fiber, WebGL

## Project Structure
* `core/binary_decoder.py`: Handles byte-level extraction of vertex and normal vectors.
* `math/tensor_calculus.py`: Contains algorithms for volume and surface area derivation.
* `api/json_serializer.py`: Structures the calculated matrix for API transmission.

## Environment Initialization

While TensorMesh Engine is strictly zero-dependency, initializing an isolated virtual environment is recommended for future architectural scaling and localized testing.
Initialize virtual environment:


python -m venv venv
source venv/bin/activate
(On Windows use: venv\Scripts\activate)

3. Execute the core serializer:



python api/json_serializer.py

<div align="center">
<a href="https://ko-fi.com/manikse">
<img src="https://storage.ko-fi.com/cdn/kofi3.png?v=3" alt="Support the developer at ko-fi.com" width="200">
</a>



<em>If TensorMesh bridged your engineering and web data, consider supporting the developer.</em>



Engineered by manikse
</div>