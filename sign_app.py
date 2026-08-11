import os

key_alias = os.environ.get("KEY_ALIAS")
key_pass = os.environ.get("KEY_PASSWORD")
store_pass = os.environ.get("STORE_PASSWORD")

gradle_path = "android/app/build.gradle"

with open(gradle_path, "r") as f:
    content = f.read()

# التأكد من عدم تكرار الإضافة
if "signingConfigs {" not in content:
    signing_block = f"""
    signingConfigs {{
        release {{
            storeFile file('keystore.jks')
            storePassword '{store_pass}'
            keyAlias '{key_alias}'
            keyPassword '{key_pass}'
        }}
    }}
    """
    # إدراج الـ signingConfigs قبل buildTypes مباشرة
    content = content.replace("buildTypes {", signing_block + "\n    buildTypes {", 1)

if "signingConfig signingConfig.release" not in content:
    # ربط release بـ signingConfig
    content = content.replace("release {", "release {\n            signingConfig signingConfig.release", 1)

with open(gradle_path, "w") as f:
    f.write(content)

print("Build.gradle successfully patched for signing.")
