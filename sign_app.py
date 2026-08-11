import os

key_alias = os.environ.get("KEY_ALIAS")
key_pass = os.environ.get("KEY_PASSWORD")
store_pass = os.environ.get("STORE_PASSWORD")

gradle_path = "android/app/build.gradle"

with open(gradle_path, "r") as f:
    content = f.read()

signing_config_block = f"""
    signingConfigs {{
        release {{
            storeFile file('keystore.jks')
            storePassword '{store_pass}'
            keyAlias '{key_alias}'
            keyPassword '{key_pass}'
        }}
    }}
"""

if "signingConfigs {" not in content:
    if "buildTypes {" in content:
        content = content.replace("buildTypes {", signing_config_block + "\n    buildTypes {", 1)

if "signingConfig signingConfig.release" not in content:
    target_release = """    buildTypes {
        release {"""
    
    replacement_release = """    buildTypes {
        release {
            signingConfig signingConfig.release"""
            
    if target_release in content:
        content = content.replace(target_release, replacement_release, 1)
    else:
        content = content.replace("release {", "release {\n            signingConfig signingConfig.release", 1)

with open(gradle_path, "w") as f:
    f.write(content)

print("Gradle updated successfully for release signing.")

