import os

# استدعاء المتغيرات من البيئة
key_alias = os.environ.get("KEY_ALIAS")
key_pass = os.environ.get("KEY_PASSWORD")
store_pass = os.environ.get("STORE_PASSWORD")

gradle_path = "android/app/build.gradle"

# قراءة محتوى الملف الحالي
with open(gradle_path, "r") as f:
    content = f.read()

# تعريف كتلة الـ signingConfigs الجديدة
signing_config_block = """
    signingConfigs {
        release {
            storeFile file('keystore.jks')
            storePassword """ + f"'{store_pass}'" + """
            keyAlias """ + f"'{key_alias}'" + """
            keyPassword """ + f"'{key_pass}'" + """
        }
    }
"""

# التأكد من عدم تكرار الإضافة
if "signingConfigs {" not in content:
    # إدراج الـ signingConfigs قبل buildTypes
    if "buildTypes {" in content:
        content = content.replace("buildTypes {", signing_config_block + "\n    buildTypes {", 1)
    else:
        # في حال لم يجد buildTypes، سيضيفها في نهاية ملف android (غير مرجح لكن احتياطي)
        # سنبحث عن آخر قوس إغلاق } يخص الـ android block
        # لكن الأفضل إضافة كتلة الـ android {} كاملة لو لم تكن موجودة
        # الحل الأبسط هو إضافتها مباشرة في نهاية الملف إذا فشلت كل الطرق
        content = content + "\n" + signing_config_block

# ربط الـ release بـ signingConfig.release
if "signingConfig signingConfig.release" not in content:
    # البحث عن تعريف الـ release داخل الـ buildTypes وإضافة السطر تحته
    target_release = """    buildTypes {
        release {"""
    
    replacement_release = """    buildTypes {
        release {
            signingConfig signingConfig.release"""
            
    if target_release in content:
        content = content.replace(target_release, replacement_release, 1)
    else:
        # محاولة بديلة في حال كان التنسيق مختلف قليلاً
        content = content.replace("release {", "release {\n            signingConfig signingConfig.release", 1)

# كتابة المحتوى المحدث للملف
with open(gradle_path, "w") as f:
    f.write(content)

print("تم تحديث ملف build.gradle بنجاح لإضافة توقيع الإصدار.")
