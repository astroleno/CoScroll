import requests

api_key = "tsk_***"
url = "https://api.tripo3d.ai/v2/openapi/upload/sts"

headers = {
    "Authorization": f"Bearer {api_key}"
}

file_path = 'cat.jpeg'

with open(file_path, 'rb') as f:
    files = {'file': (file_path, f, 'image/jpeg')}
    response = requests.post(url, headers=headers, files=files)

print(response.json())


import requests
import json

api_key = "tsk_***"
url = "https://api.tripo3d.ai/v2/openapi/task"

data = {
    "type": "image_to_model",
    "file": {
        "type": "jpg",
        "file_token": "***"
    }
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

response = requests.post(url, headers=headers, json=data)

print(response.json())


Image to Model
Request
type: This field must be set to image_to_model.

model_version (Optional): Model version. Available versions are as below:

Turbo-v1.0-20250506
v3.0-20250812
v2.5-20250123
v2.0-20240919
v1.4-20240625
v1.3-20240522 (Deprecated)
If this option is not set, the default value will be v2.5-20250123.

file: Specifies the image input. The resolution of each image must be between 20px and 6000px. The suggested resolution should be more than 256px

type: Indicates the file type. Although currently not validated, specifying the correct file type is strongly advised.
file_token: The identifier you get from upload, please read Docs/Upload. Mutually exclusive with url and object.
url: A direct URL to the image. Supports JPEG and PNG formats with maximum size of 20MB. Mutually exclusive with file_token and object.
object: The information you get from upload (STS), please read Docs/Upload (STS). Mutually exclusive with url and file_token.
bucket: Normally should be tripo-data.
key: The resource_uri got from session token.
model_seed (Optional): This is the random seed for model generation. For model_version>=v2.0-20240919, the seed controls the geometry generation process, ensuring identical models when the same seed is used. This parameter is an integer and is randomly chosen if not set.

The options below are only valid for model_version>=v2.0-20240919

face_limit (Optional): Limits the number of faces on the output model. If this option is not set, the face limit will be adaptively determined. If smart_low_poly=true, it should be 1000~16000, if quad=true as well, it should be 500~8000.
texture (Optional): A boolean option to enable texturing. The default value is true, set false to get a base model without any textures.
pbr (Optional): A boolean option to enable pbr. The default value is true, set false to get a model without pbr. If this option is set to true, texture will be ignored and used as true.
texture_seed (Optional): This is the random seed for texture generation for model_version>=v2.0-20240919. Using the same seed will produce identical textures. This parameter is an integer and is randomly chosen if not set. If you want a model with different textures, please use same model_seed and different texture_seed.
texture_alignment (Optional): Determines the prioritization of texture alignment in the 3D model. The default value is original_image.
original_image: Prioritizes visual fidelity to the source image. This option produces textures that closely resemble the original image but may result in minor 3D inconsistencies.
geometry: Prioritizes 3D structural accuracy. This option ensures better alignment with the model’s geometry but may cause slight deviations from the original image appearance.
texture_quality (Optional): This parameter controls the texture quality. detailed provides high-resolution textures, resulting in more refined and realistic representation of intricate parts. This option is ideal for models where fine details are crucial for visual fidelity. The default value is standard.
auto_size (Optional): Automatically scale the model to real-world dimensions, with the unit in meters. The default value is false.
style (Optional): Defines the artistic style or transformation to be applied to the 3D model, altering its appearance according to preset options. Omit this option to keep the original style and appearance.
orientation (Optional): Set orientation=align_image to automatically rotate the model to align the original image. The default value is default.
quad (Optional): Set true to enable quad mesh output. If quad=true and face_limit is not set, the default face_limit will be 10000.
Note: Enabling this option will force the output to be an FBX model.
compress (Optional): Specifies the compression type to apply to the texture. Available values are:
geometry: Applies geometry-based compression to optimize the output, By Default we use meshopt compression
smart_low_poly (Optional): Generate low-poly meshes with hand‑crafted topology. Inputs with less complexity work best. There is a possibility of failure for complex models. The default value is false.
generate_parts (Optional): Generate segmented 3D models and make each part editable. The default value is false.
Note: generate_parts is not compatible with texture=true or pbr=true, if you want to generate parts, please set texture=false and pbr=false; generate_parts is not compatible with quad=true, if you want to generate parts, please set quad=false.
The options below are only valid for model_version>=v3.0-20250812

geometry_quality (Optional): Maximum detail for the most intricate and realistic models when setting detailed. The default value will be standard.