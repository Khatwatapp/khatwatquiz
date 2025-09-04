# تطبيق الاختبارات الإلكتروني - النسخة المنفصلة

تطبيق اختبارات إلكتروني كامل مع ملفات منفصلة، يعمل على Google Sheets و Apps Script، مع واجهة مستخدم عربية جميلة ومتجاوبة.

## المميزات

- ✅ تسجيل بيانات الطالب (الاسم، الإيميل، السن، المرحلة الدراسية)
- ✅ سحب الأسئلة من Google Sheets مع shuffle للأسئلة والخيارات
- ✅ عرض الأسئلة مع إمكانية اختيار الإجابة
- ✅ إظهار الإجابة الصحيحة فوراً مع التمييز بالألوان
- ✅ حفظ جميع النتائج في Google Sheets
- ✅ عرض النتائج النهائية مع مراجعة شاملة
- ✅ تصميم عربي متجاوب وجميل
- ✅ ملفات منفصلة قابلة للنشر على GitHub Pages أو أي سيرفر ويب

## هيكل الملفات

```
quiz-app-standalone/
├── index-standalone.html    # HTML interface
├── styles.css              # CSS styling
├── script-standalone.js    # JavaScript functionality
├── Code-standalone.gs      # Apps Script backend
└── README-standalone.md    # Documentation
```

## إعداد التطبيق

### 1. إعداد Google Sheets

1. اذهب إلى [Google Sheets](https://sheets.google.com)
2. أنشئ spreadsheet جديد
3. أعد تسميته إلى "Quiz App Data"
4. انسخ ID من الرابط (بين `/d/` و `/edit`)

#### إعداد ورقة الأسئلة:
- أعد تسمية الورقة الأولى إلى "Questions"
- أضف العناوين في الصف الأول:
  - A1: question
  - B1: optionA
  - C1: optionB
  - D1: optionC
  - E1: optionD
  - F1: correct

#### أضف بعض الأسئلة التجريبية:
```
| question | optionA | optionB | optionC | optionD | correct |
|----------|---------|---------|---------|---------|---------|
| ما هو لون السماء؟ | أزرق | أحمر | أخضر | أصفر | A |
| ما هو 2 + 2؟ | 3 | 4 | 5 | 6 | B |
| ما هي عاصمة مصر؟ | الإسكندرية | القاهرة | الأقصر | أسوان | B |
```

### 2. إعداد Apps Script

1. اذهب إلى [Google Apps Script](https://script.google.com)
2. انقر على "New Project"
3. أعد تسمية المشروع إلى "Quiz App Standalone"
4. احذف الكود الافتراضي في `Code.gs`
5. انسخ محتوى ملف `Code-standalone.gs`
6. غيّر `YOUR_SPREADSHEET_ID_HERE` إلى ID الخاص بـ Spreadsheet

### 3. إعداد النشر

1. انقر على "Deploy" > "New deployment"
2. اختر "Web app" كنوع النشر
3. في "Execute as" اختر "Me"
4. في "Who has access" اختر "Anyone"
5. انقر على "Deploy"
6. انسخ URL النشر

### 4. تحديث JavaScript

في ملف `script-standalone.js`، غيّر السطر:

```javascript
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```

إلى URL الخاص بك:

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```

## النشر على GitHub Pages

### 1. إنشاء مستودع GitHub

1. اذهب إلى [GitHub](https://github.com)
2. أنشئ مستودع جديد
3. فعّل GitHub Pages من Settings > Pages

### 2. رفع الملفات

ارفع الملفات التالية إلى المستودع:
- `index-standalone.html` (أعد تسميته إلى `index.html`)
- `styles.css`
- `script-standalone.js` (أعد تسميته إلى `script.js`)

### 3. تحديث HTML

في ملف `index.html`، غيّر:

```html
<script src="script-standalone.js"></script>
```

إلى:

```html
<script src="script.js"></script>
```

## استخدام التطبيق

### 1. تسجيل الطالب
- أدخل الاسم الكامل
- أدخل البريد الإلكتروني
- أدخل السن (اختياري)
- اختر المرحلة الدراسية
- انقر على "ابدأ الامتحان"

### 2. حل الاختبار
- اقرأ السؤال بعناية
- اختر الإجابة الصحيحة
- ستظهر الإجابة الصحيحة فوراً
- انقر على "التالي" للانتقال للسؤال التالي
- في السؤال الأخير، انقر على "إنهاء الامتحان"

### 3. مراجعة النتائج
- عرض النتيجة النهائية
- مراجعة جميع الإجابات
- إمكانية إعادة الامتحان أو تسجيل طالب جديد

## الفرق بين النسختين

### النسخة المدمجة (الأصلية):
- HTML + CSS + JS في ملف واحد
- تعمل داخل Apps Script
- أسهل في الإعداد

### النسخة المنفصلة:
- ملفات منفصلة
- قابلة للنشر على GitHub Pages
- أكثر مرونة في التخصيص
- أسهل في الصيانة

## استكشاف الأخطاء

### مشاكل شائعة:

1. **خطأ CORS**
   - تأكد من نشر Apps Script كـ Web App
   - تأكد من إعداد "Who has access" إلى "Anyone"

2. **خطأ في تحميل الأسئلة**
   - تأكد من صحة Spreadsheet ID
   - تأكد من وجود ورقة "Questions"
   - تأكد من صحة تنسيق البيانات

3. **خطأ في حفظ النتائج**
   - تأكد من صلاحيات Apps Script
   - تأكد من وجود مساحة كافية في Spreadsheet

## التخصيص

### تغيير الألوان:
عدّل المتغيرات في `styles.css`:

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #28a745;
  --danger-color: #dc3545;
}
```

### إضافة مميزات جديدة:
1. عدّل `Code-standalone.gs` لإضافة وظائف جديدة
2. عدّل `script-standalone.js` لإضافة تفاعلات جديدة
3. عدّل `index-standalone.html` لإضافة عناصر جديدة

## الدعم

إذا واجهت أي مشاكل:

1. تحقق من console المتصفح للأخطاء
2. تأكد من صحة إعدادات Apps Script
3. تحقق من صلاحيات الوصول إلى Google Sheets
4. تأكد من صحة URL في JavaScript

## الترخيص

هذا المشروع مفتوح المصدر ومتاح للاستخدام الشخصي والتعليمي.

---

**ملاحظة**: تأكد من استبدال `YOUR_SPREADSHEET_ID_HERE` و `YOUR_APPS_SCRIPT_URL_HERE` بالقيم الصحيحة قبل النشر.

