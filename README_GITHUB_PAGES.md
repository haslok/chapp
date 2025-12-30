# إعداد التطبيق للعمل على GitHub Pages

## المشكلة
GitHub Pages يستضيف فقط ملفات ثابتة (HTML, CSS, JS) ولا يدعم خوادم Node.js أو WebSocket. لذلك، تم تحويل التطبيق ليعمل بالكامل من المتصفح باستخدام Supabase Client SDK.

## الحل
تم تحديث الكود لاستخدام Supabase Client SDK مباشرة من المتصفح، مما يسمح للتطبيق بالعمل على GitHub Pages بدون الحاجة لخادم Node.js.

## خطوات الإعداد

### 1. إعداد Supabase

1. اذهب إلى [Supabase](https://supabase.com) وأنشئ حساب مجاني
2. أنشئ مشروع جديد
3. اذهب إلى **Settings** > **API**
4. انسخ:
   - **Project URL** (مثل: `https://xxxxx.supabase.co`)
   - **anon/public key** (المفتاح العام - آمن للاستخدام في الكود)

### 2. إعداد قاعدة البيانات

في Supabase Dashboard، اذهب إلى **SQL Editor** وقم بتنفيذ هذا الكود:

```sql
-- إنشاء جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    public_key TEXT DEFAULT 'placeholder-public-key',
    is_online BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- تفعيل Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسة للسماح بالقراءة والكتابة للجميع (للتطبيقات البسيطة)
-- تحذير: في الإنتاج، يجب استخدام سياسات أكثر أماناً
CREATE POLICY "Allow all operations" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- تفعيل Realtime للجدول
ALTER PUBLICATION supabase_realtime ADD TABLE users;
```

### 3. تحديث ملف config.js

افتح ملف `config.js` واستبدل:

```javascript
const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL', // استبدل بـ Project URL من Supabase
    anonKey: 'YOUR_SUPABASE_ANON_KEY' // استبدل بـ anon key من Supabase
};
```

**مثال:**
```javascript
const SUPABASE_CONFIG = {
    url: 'https://abcdefghijklmnop.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

### 4. رفع الملفات على GitHub Pages

1. ارفع جميع الملفات إلى مستودع GitHub
2. اذهب إلى **Settings** > **Pages**
3. اختر **Source**: `main` branch (أو الفرع الذي تريده)
4. احفظ التغييرات
5. انتظر بضع دقائق حتى يتم النشر

### 5. اختبار التطبيق

1. افتح الموقع المنشور على GitHub Pages
2. جرب إنشاء حساب جديد
3. جرب تسجيل الدخول
4. تحقق من أن قائمة المستخدمين المتصلين تعمل

## ملاحظات مهمة

### الأمان
- **كلمات المرور**: حالياً، كلمات المرور تُخزن كنص عادي في قاعدة البيانات. في الإنتاج، يجب استخدام hashing (مثل bcrypt)
- **RLS Policies**: السياسات الحالية تسمح للجميع بالوصول. في الإنتاج، يجب إنشاء سياسات أكثر أماناً

### الميزات المدعومة
- ✅ تسجيل الدخول والتسجيل
- ✅ عرض المستخدمين المتصلين
- ✅ تحديث حالة الاتصال في الوقت الفعلي (Realtime)
- ✅ التشفير الاختياري للرسائل
- ✅ حفظ حالة المستخدم في localStorage

### الميزات غير المدعومة (تحتاج خادم)
- ❌ Socket.IO (يتم استخدام Supabase Realtime بدلاً منه)
- ❌ Rate limiting من الخادم
- ❌ معالجة متقدمة للرسائل المشفرة (تعمل محلياً فقط حالياً)

## استكشاف الأخطاء

### خطأ: "Supabase not configured"
- تأكد من تحديث `config.js` بـ Supabase credentials الصحيحة
- تأكد من أن ملف `config.js` يتم تحميله قبل `script.js`

### خطأ: "Failed to fetch" أو "Network error"
- تحقق من أن Supabase URL صحيح
- تحقق من أن RLS policies تسمح بالوصول
- افتح Console في المتصفح لرؤية الأخطاء التفصيلية

### المستخدمون المتصلون لا يظهرون
- تحقق من أن Realtime مفعّل في Supabase
- تأكد من تنفيذ `ALTER PUBLICATION supabase_realtime ADD TABLE users;`

## بدائل أخرى

إذا كنت تريد استخدام خادم Node.js، يمكنك استخدام:
- **Render** (مجاني)
- **Railway** (مجاني مع حد معين)
- **Vercel** (يدعم Serverless Functions)
- **Heroku** (مدفوع)

لكن GitHub Pages هو الأسهل والأسرع للنشر!
