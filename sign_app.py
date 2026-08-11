import os

key_alias = os.environ.get("KEY_ALIAS")
key_pass = os.environ.get("KEY_PASSWORD")
store_pass = os.environ.get("STORE_PASSWORD")

gradle_path = "android/app/build.gradle"
with open(gradle_path, "r") as f:
    lines = f.readlines()

new_lines = []
signing_added = False
building_types_found = False

for line in lines:
    if "buildTypes {" in line and not signing_added:
        new_lines.append("    signingConfigs {\n")
        new_lines.append("        release {\n")
        new_lines.append("            storeFile file(\"keystore.jks\")\n")
        new_lines.append(f"            storePassword \"{store_pass}\"\n")
        new_lines.append(f"            keyAlias \"{key_alias}\"\n")
        new_lines.append(f"            keyPassword \"{key_pass}\"\n")
        new_lines.append("        }\n")
        new_lines.append("    }\n")
        signing_added = True

    if "release {" in line and not building_types_found:
        new_lines.append(line)
        new_lines.append("            signingConfig signingConfig.release\n")
        building_types_found = True
        continue

    new_lines.append(line)

with open(gradle_path, "w") as f:
    f.writelines(new_lines)
  
