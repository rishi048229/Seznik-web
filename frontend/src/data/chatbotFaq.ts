// Seznik POS Help Chatbot — Pre-fed FAQ Knowledge Base
// Organized by category with multi-language support (en, hi, mr, ta, te, gu)
// Each entry has keywords for fuzzy matching and answers in all supported languages.

export type ChatLang = 'en' | 'hi' | 'mr' | 'ta' | 'te' | 'gu'

export const CHAT_LANGUAGES: { code: ChatLang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
]

export interface FaqEntry {
  id: number
  category: string
  keywords: string[]
  question: Record<ChatLang, string>
  answer: Record<ChatLang, string>
}

export const FAQ_CATEGORIES = [
  { id: 'getting_started', label: '🚀 Getting Started', labelHi: '🚀 शुरुआत' },
  { id: 'login_auth', label: '🔐 Login & Auth', labelHi: '🔐 लॉगिन' },
  { id: 'printer', label: '🖨️ Printing', labelHi: '🖨️ प्रिंटिंग' },
  { id: 'label', label: '🏷️ Labels & Barcodes', labelHi: '🏷️ लेबल' },
  { id: 'products', label: '📦 Products', labelHi: '📦 उत्पाद' },
  { id: 'pos', label: '🛒 Point of Sale', labelHi: '🛒 पॉइंट ऑफ सेल' },
  { id: 'sales', label: '📊 Sales & Reports', labelHi: '📊 बिक्री' },
  { id: 'customers', label: '👥 Customers', labelHi: '👥 ग्राहक' },
  { id: 'settings', label: '⚙️ Settings', labelHi: '⚙️ सेटिंग्स' },
  { id: 'billing', label: '🧾 Billing & Invoice', labelHi: '🧾 बिलिंग' },
  { id: 'troubleshooting', label: '🛠️ Troubleshooting', labelHi: '🛠️ समस्या निवारण' },
]

export const FAQ_DATA: FaqEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GETTING STARTED (1–10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 1, category: 'getting_started',
    keywords: ['start', 'begin', 'new', 'setup', 'first time', 'how to use', 'kaise use kare'],
    question: {
      en: 'How do I get started with Seznik POS?',
      hi: 'Seznik POS का उपयोग कैसे शुरू करें?',
      mr: 'Seznik POS कसे सुरू करायचे?',
      ta: 'Seznik POS-ஐ எப்படி தொடங்குவது?',
      te: 'Seznik POS ఎలా ప్రారంభించాలి?',
      gu: 'Seznik POS કેવી રીતે શરૂ કરવું?',
    },
    answer: {
      en: 'Welcome! 🎉 To get started:\n1. Log in with your admin email & password\n2. Complete the onboarding wizard (business name, GSTIN, etc.)\n3. Add your product categories\n4. Add your products with prices & stock\n5. Start selling via the POS page!\n\nYou can also connect a Bluetooth printer from the Printers page.',
      hi: 'स्वागत है! 🎉 शुरू करने के लिए:\n1. अपने एडमिन ईमेल और पासवर्ड से लॉगिन करें\n2. ऑनबोर्डिंग विज़ार्ड पूरा करें (व्यापार का नाम, GSTIN आदि)\n3. अपनी उत्पाद श्रेणियाँ जोड़ें\n4. कीमत और स्टॉक के साथ उत्पाद जोड़ें\n5. POS पेज से बेचना शुरू करें!\n\nआप प्रिंटर पेज से ब्लूटूथ प्रिंटर भी कनेक्ट कर सकते हैं।',
      mr: 'स्वागत आहे! 🎉 सुरू करण्यासाठी:\n1. तुमच्या एडमिन ईमेल आणि पासवर्डने लॉगिन करा\n2. ऑनबोर्डिंग विझार्ड पूर्ण करा\n3. उत्पाद श्रेणी जोडा\n4. किमती आणि स्टॉकसह उत्पादने जोडा\n5. POS पृष्ठावरून विक्री सुरू करा!',
      ta: 'வரவேற்கிறோம்! 🎉 தொடங்க:\n1. உங்கள் நிர்வாக மின்னஞ்சல் மற்றும் கடவுச்சொல்லுடன் உள்நுழையவும்\n2. அறிமுக வழிகாட்டியை நிறைவு செய்யவும்\n3. தயாரிப்பு வகைகளைச் சேர்க்கவும்\n4. விலைகள் மற்றும் இருப்புடன் தயாரிப்புகளைச் சேர்க்கவும்\n5. POS பக்கத்தில் விற்பனை தொடங்கவும்!',
      te: 'స్వాగతం! 🎉 ప్రారంభించడానికి:\n1. మీ అడ్మిన్ ఇమెయిల్ & పాస్‌వర్డ్‌తో లాగిన్ చేయండి\n2. ఆన్‌బోర్డింగ్ విజార్డ్ పూర్తి చేయండి\n3. ఉత్పత్తి వర్గాలను జోడించండి\n4. ధరలు & స్టాక్‌తో ఉత్పత్తులను జోడించండి\n5. POS పేజీ నుండి అమ్మకాలు ప్రారంభించండి!',
      gu: 'સ્વાગત છે! 🎉 શરૂ કરવા:\n1. તમારા એડમિન ઈમેલ અને પાસવર્ડથી લૉગિન કરો\n2. ઓનબોર્ડિંગ વિઝાર્ડ પૂરો કરો\n3. ઉત્પાદન શ્રેણીઓ ઉમેરો\n4. ભાવ અને સ્ટૉક સાથે ઉત્પાદનો ઉમેરો\n5. POS પેજથી વેચાણ શરૂ કરો!',
    },
  },
  {
    id: 2, category: 'getting_started',
    keywords: ['onboarding', 'wizard', 'setup wizard', 'business profile', 'company name'],
    question: {
      en: 'What is the onboarding wizard?',
      hi: 'ऑनबोर्डिंग विज़ार्ड क्या है?',
      mr: 'ऑनबोर्डिंग विझार्ड काय आहे?',
      ta: 'அறிமுக வழிகாட்டி என்ன?',
      te: 'ఆన్‌బోర్డింగ్ విజార్డ్ ఏమిటి?',
      gu: 'ઓનબોર્ડિંગ વિઝાર્ડ શું છે?',
    },
    answer: {
      en: 'The onboarding wizard helps you set up your business profile when you first register. You\'ll enter your:\n• Business Name\n• Address & Phone\n• GSTIN number\n• Logo (optional)\n\nThis information is used on receipts, invoices, and label prints.',
      hi: 'ऑनबोर्डिंग विज़ार्ड आपके पहली बार रजिस्टर करने पर व्यापार प्रोफ़ाइल सेट करने में मदद करता है। आप दर्ज करेंगे:\n• व्यापार का नाम\n• पता और फ़ोन\n• GSTIN नंबर\n• लोगो (वैकल्पिक)\n\nयह जानकारी रसीदों, चालानों और लेबल प्रिंट पर उपयोग होती है।',
      mr: 'ऑनबोर्डिंग विझार्ड तुम्हाला पहिल्यांदा नोंदणी करताना व्यवसाय प्रोफाइल सेट करण्यात मदत करतो.',
      ta: 'அறிமுக வழிகாட்டி உங்கள் வணிக விவரங்களை அமைக்க உதவுகிறது.',
      te: 'ఆన్‌బోర్డింగ్ విజార్డ్ మీ వ్యాపార ప్రొఫైల్‌ను సెటప్ చేయడంలో సహాయపడుతుంది.',
      gu: 'ઓનબોર્ડિંગ વિઝાર્ડ તમારી વ્યવસાય પ્રોફાઇલ સેટ કરવામાં મદદ કરે છે.',
    },
  },
  {
    id: 3, category: 'getting_started',
    keywords: ['dashboard', 'home', 'overview', 'main page'],
    question: {
      en: 'What can I see on the Dashboard?',
      hi: 'डैशबोर्ड पर क्या दिखाई देता है?',
      mr: 'डॅशबोर्डवर काय दिसते?',
      ta: 'டாஷ்போர்டில் என்ன காணலாம்?',
      te: 'డాష్‌బోర్డ్‌లో ఏమి చూడగలను?',
      gu: 'ડેશબોર્ડ પર શું જોઈ શકાય?',
    },
    answer: {
      en: 'The Dashboard shows a real-time overview of your business:\n• Today\'s Sales & Revenue\n• Total Products & Low Stock Alerts\n• Recent Sales History\n• Revenue Charts & Trends\n• Quick Stats (Total Customers, Total Sales, etc.)\n\nIt\'s the first page you see after logging in.',
      hi: 'डैशबोर्ड आपके व्यापार का रीयल-टाइम अवलोकन दिखाता है:\n• आज की बिक्री और राजस्व\n• कुल उत्पाद और कम स्टॉक अलर्ट\n• हाल की बिक्री इतिहास\n• राजस्व चार्ट और रुझान',
      mr: 'डॅशबोर्ड तुमच्या व्यवसायाचा रीअल-टाइम आढावा दाखवतो.',
      ta: 'டாஷ்போர்ட் உங்கள் வணிகத்தின் நிகழ்நேர கண்ணோட்டத்தைக் காட்டுகிறது.',
      te: 'డాష్‌బోర్డ్ మీ వ్యాపారం యొక్క రియల్-టైమ్ అవలోకనాన్ని చూపిస్తుంది.',
      gu: 'ડેશબોર્ડ તમારા વ્યવસાયનું રીઅલ-ટાઇમ ઓવરવ્યુ બતાવે છે.',
    },
  },
  {
    id: 4, category: 'getting_started',
    keywords: ['admin', 'agent', 'role', 'workspace', 'access', 'permission'],
    question: {
      en: 'What\'s the difference between Admin and Agent?',
      hi: 'एडमिन और एजेंट में क्या अंतर है?',
      mr: 'एडमिन आणि एजंट मध्ये काय फरक आहे?',
      ta: 'நிர்வாகி மற்றும் முகவர் இடையே என்ன வேறுபாடு?',
      te: 'అడ్మిన్ మరియు ఏజెంట్ మధ్య తేడా ఏమిటి?',
      gu: 'એડમિન અને એજન્ટ વચ્ચે શું તફાવત છે?',
    },
    answer: {
      en: '👤 **Admin** — Full access to all features. Can manage products, suppliers, reports, settings, and create agent accounts.\n\n👷 **Agent** — Limited access based on permissions set by the Admin. Typically handles sales (POS), customer management, and basic stock viewing. Agents cannot access sensitive features like supplier management or financial reports unless permitted.',
      hi: '👤 **एडमिन** — सभी सुविधाओं तक पूर्ण पहुंच। उत्पाद, आपूर्तिकर्ता, रिपोर्ट, सेटिंग्स प्रबंधित कर सकते हैं और एजेंट खाते बना सकते हैं।\n\n👷 **एजेंट** — एडमिन द्वारा निर्धारित अनुमतियों के आधार पर सीमित पहुंच।',
      mr: '👤 **एडमिन** — सर्व वैशिष्ट्यांमध्ये पूर्ण प्रवेश.\n\n👷 **एजंट** — एडमिनने सेट केलेल्या परवानग्यांवर आधारित मर्यादित प्रवेश.',
      ta: '👤 **நிர்வாகி** — அனைத்து அம்சங்களுக்கும் முழு அணுகல்.\n\n👷 **முகவர்** — நிர்வாகியால் அமைக்கப்பட்ட அனுமதிகளின் அடிப்படையில் வரையறுக்கப்பட்ட அணுகல்.',
      te: '👤 **అడ్మిన్** — అన్ని ఫీచర్‌లకు పూర్తి యాక్సెస్.\n\n👷 **ఏజెంట్** — అడ్మిన్ సెట్ చేసిన అనుమతుల ఆధారంగా పరిమిత యాక్సెస్.',
      gu: '👤 **એડમિન** — તમામ ફીચર્સ માટે સંપૂર્ણ ઍક્સેસ.\n\n👷 **એજન્ટ** — એડમિને સેટ કરેલી પરવાનગીઓ મુજબ મર્યાદિત ઍક્સેસ.',
    },
  },
  {
    id: 5, category: 'getting_started',
    keywords: ['language', 'bhasha', 'hindi', 'change language', 'tamil', 'telugu', 'marathi', 'gujarati'],
    question: {
      en: 'How do I change the app language?',
      hi: 'ऐप की भाषा कैसे बदलें?',
      mr: 'ॲपची भाषा कशी बदलायची?',
      ta: 'பயன்பாட்டு மொழியை எப்படி மாற்றுவது?',
      te: 'యాప్ భాషను ఎలా మార్చాలి?',
      gu: 'એપ ભાષા કેવી રીતે બદલવી?',
    },
    answer: {
      en: 'Go to **Settings** (⚙️ in sidebar) and look for the Language selector. We support:\n• English 🇬🇧\n• हिंदी (Hindi) 🇮🇳\n• मराठी (Marathi)\n• தமிழ் (Tamil)\n• తెలుగు (Telugu)\n• ગુજરાતી (Gujarati)\n\nThe app will instantly switch to your chosen language.',
      hi: '**सेटिंग्स** (⚙️ साइडबार में) में जाएं और भाषा चयनकर्ता खोजें। हम सपोर्ट करते हैं:\n• English 🇬🇧\n• हिंदी 🇮🇳\n• मराठी\n• தமிழ் (Tamil)\n• తెలుగు (Telugu)\n• ગુજરાતી (Gujarati)',
      mr: '**सेटिंग्ज** (⚙️) मध्ये जा आणि भाषा निवडक शोधा.',
      ta: '**அமைப்புகள்** (⚙️) சென்று மொழி தேர்வியைக் கண்டறியவும்.',
      te: '**సెట్టింగ్‌లు** (⚙️) కి వెళ్లి భాష సెలెక్టర్ కనుగొనండి.',
      gu: '**સેટિંગ્સ** (⚙️) માં જાઓ અને ભાષા સિલેક્ટર શોધો.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN & AUTH (6–15)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 6, category: 'login_auth',
    keywords: ['login', 'sign in', 'log in', 'email', 'password', 'kaise login kare'],
    question: {
      en: 'How do I log in?',
      hi: 'लॉगिन कैसे करें?',
      mr: 'लॉगिन कसे करावे?',
      ta: 'உள்நுழைவது எப்படி?',
      te: 'లాగిన్ ఎలా చేయాలి?',
      gu: 'લૉગિન કેવી રીતે કરવું?',
    },
    answer: {
      en: 'Open the app and enter your registered email address and password. Click "Sign In". If you are an Admin, you\'ll go directly to your dashboard. If you have multiple workspaces (Admin + Agent), you\'ll see a role selection screen.',
      hi: 'ऐप खोलें और अपना पंजीकृत ईमेल और पासवर्ड दर्ज करें। "साइन इन" पर क्लिक करें।',
      mr: 'ॲप उघडा आणि तुमचा नोंदणीकृत ईमेल आणि पासवर्ड टाका.',
      ta: 'பயன்பாட்டைத் திறந்து உங்கள் பதிவு செய்த மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.',
      te: 'యాప్ తెరిచి మీ రిజిస్టర్డ్ ఇమెయిల్ & పాస్‌వర్డ్ ఎంటర్ చేయండి.',
      gu: 'એપ ખોલો અને તમારું રજિસ્ટર્ડ ઈમેલ અને પાસવર્ડ દાખલ કરો.',
    },
  },
  {
    id: 7, category: 'login_auth',
    keywords: ['forgot', 'password', 'reset', 'otp', 'bhool gaya', 'password change'],
    question: {
      en: 'I forgot my password. How do I reset it?',
      hi: 'मैं अपना पासवर्ड भूल गया। इसे कैसे रीसेट करें?',
      mr: 'मी पासवर्ड विसरलो. तो कसा रीसेट करू?',
      ta: 'கடவுச்சொல் மறந்துவிட்டது. எப்படி மீட்டமைப்பது?',
      te: 'పాస్‌వర్డ్ మర్చిపోయాను. రీసెట్ ఎలా చేయాలి?',
      gu: 'પાસવર્ડ ભૂલી ગયો. રીસેટ કેવી રીતે કરવું?',
    },
    answer: {
      en: 'On the login page, click "Forgot Password?". Then:\n1. Enter your registered email address\n2. We\'ll send a 6-digit OTP to your email\n3. Enter the OTP code\n4. Set your new password\n5. Log in with the new password!\n\nThe OTP expires in 10 minutes.',
      hi: 'लॉगिन पेज पर "पासवर्ड भूल गए?" पर क्लिक करें। फिर:\n1. अपना पंजीकृत ईमेल दर्ज करें\n2. हम आपके ईमेल पर 6-अंकीय OTP भेजेंगे\n3. OTP कोड दर्ज करें\n4. नया पासवर्ड सेट करें\n5. नए पासवर्ड से लॉगिन करें!\n\nOTP 10 मिनट में समाप्त हो जाता है।',
      mr: 'लॉगिन पेजवर "पासवर्ड विसरलात?" वर क्लिक करा.\n1. नोंदणीकृत ईमेल टाका\n2. 6-अंकी OTP येईल\n3. OTP टाका\n4. नवीन पासवर्ड सेट करा',
      ta: 'உள்நுழைவு பக்கத்தில் "கடவுச்சொல் மறந்துவிட்டதா?" என்பதைக் கிளிக் செய்யவும்.',
      te: 'లాగిన్ పేజీలో "పాస్‌వర్డ్ మర్చిపోయారా?" క్లిక్ చేయండి.',
      gu: 'લૉગિન પેજ પર "પાસવર્ડ ભૂલી ગયા?" ક્લિક કરો.',
    },
  },
  {
    id: 8, category: 'login_auth',
    keywords: ['otp', 'not received', 'email not coming', 'verification code'],
    question: {
      en: 'I didn\'t receive the OTP email. What do I do?',
      hi: 'मुझे OTP ईमेल नहीं मिला। क्या करूं?',
      mr: 'मला OTP ईमेल आला नाही. काय करू?',
      ta: 'OTP மின்னஞ்சல் வரவில்லை. என்ன செய்வது?',
      te: 'OTP ఇమెయిల్ రాలేదు. ఏం చేయాలి?',
      gu: 'OTP ઈમેલ નથી આવ્યો. શું કરવું?',
    },
    answer: {
      en: 'If you didn\'t receive the OTP:\n1. Check your **Spam/Junk** folder\n2. Make sure you entered the correct email address\n3. Wait 1–2 minutes, emails can be delayed\n4. Try clicking "Resend OTP"\n5. If still not working, contact your admin to verify your email is registered in the system.',
      hi: 'अगर OTP नहीं मिला:\n1. अपना **स्पैम/जंक** फ़ोल्डर चेक करें\n2. सुनिश्चित करें कि आपने सही ईमेल दर्ज किया है\n3. 1-2 मिनट प्रतीक्षा करें\n4. "OTP पुनः भेजें" पर क्लिक करें',
      mr: 'OTP न आल्यास:\n1. स्पॅम/जंक फोल्डर तपासा\n2. बरोबर ईमेल टाकला का ते तपासा',
      ta: 'OTP வரவில்லை என்றால்:\n1. ஸ்பேம்/ஜங்க் கோப்புறையைச் சரிபார்க்கவும்',
      te: 'OTP రాకపోతే:\n1. స్పామ్/జంక్ ఫోల్డర్ చెక్ చేయండి',
      gu: 'OTP ન આવ્યો તો:\n1. સ્પેમ/જંક ફોલ્ડર ચેક કરો',
    },
  },
  {
    id: 9, category: 'login_auth',
    keywords: ['agent', 'create', 'add user', 'new user', 'sub account', 'staff'],
    question: {
      en: 'How do I create an Agent account for my staff?',
      hi: 'अपने कर्मचारी के लिए एजेंट खाता कैसे बनाएं?',
      mr: 'माझ्या कर्मचाऱ्यासाठी एजंट खाते कसे तयार करावे?',
      ta: 'என் ஊழியருக்கு ஒரு முகவர் கணக்கை எப்படி உருவாக்குவது?',
      te: 'నా సిబ్బందికి ఏజెంట్ ఖాతా ఎలా సృష్టించాలి?',
      gu: 'મારા સ્ટાફ માટે એજન્ટ ખાતું કેવી રીતે બનાવવું?',
    },
    answer: {
      en: 'As an Admin, go to **Settings** → **Manage Users** section. Click "Add Agent" and fill in:\n• Agent Name\n• Email Address\n• Password\n• Permissions (what they can access)\n\nThe agent can then log in with their email/password and select the "Agent" role.',
      hi: 'एडमिन के रूप में, **सेटिंग्स** → **उपयोगकर्ता प्रबंधित करें** में जाएं। "एजेंट जोड़ें" पर क्लिक करें और भरें:\n• एजेंट का नाम\n• ईमेल\n• पासवर्ड\n• अनुमतियाँ',
      mr: 'एडमिन म्हणून **सेटिंग्ज** → **युजर्स व्यवस्थापित करा** मध्ये जा.',
      ta: 'நிர்வாகியாக **அமைப்புகள்** → **பயனர்களை நிர்வகி** பகுதிக்கு செல்லவும்.',
      te: 'అడ్మిన్‌గా **సెట్టింగ్‌లు** → **యూజర్‌లను నిర్వహించు** కి వెళ్ళండి.',
      gu: 'એડમિન તરીકે **સેટિંગ્સ** → **યુઝર્સ મેનેજ કરો** માં જાઓ.',
    },
  },
  {
    id: 10, category: 'login_auth',
    keywords: ['change password', 'update password', 'password change'],
    question: {
      en: 'How do I change my password?',
      hi: 'अपना पासवर्ड कैसे बदलें?',
      mr: 'पासवर्ड कसा बदलायचा?',
      ta: 'கடவுச்சொல்லை எப்படி மாற்றுவது?',
      te: 'పాస్‌వర్డ్ ఎలా మార్చాలి?',
      gu: 'પાસવર્ડ કેવી રીતે બદલવો?',
    },
    answer: {
      en: 'You can change your password using the Forgot Password flow:\n1. Log out of the app\n2. Click "Forgot Password?" on the login page\n3. Enter your email to receive OTP\n4. Verify the OTP and set a new password\n\nYour new password will be updated instantly in the database.',
      hi: 'आप पासवर्ड भूल गए फ्लो का उपयोग करके पासवर्ड बदल सकते हैं:\n1. ऐप से लॉग आउट करें\n2. लॉगिन पेज पर "पासवर्ड भूल गए?" क्लिक करें\n3. OTP प्राप्त करने के लिए ईमेल दर्ज करें\n4. OTP सत्यापित करें और नया पासवर्ड सेट करें',
      mr: 'पासवर्ड बदलण्यासाठी "पासवर्ड विसरलात?" वापरा.',
      ta: '"கடவுச்சொல் மறந்துவிட்டதா?" பயன்படுத்தி கடவுச்சொல்லை மாற்றவும்.',
      te: '"పాస్‌వర్డ్ మర్చిపోయారా?" ఉపయోగించి పాస్‌వర్డ్ మార్చండి.',
      gu: '"પાસવર્ડ ભૂલી ગયા?" વાપરીને પાસવર્ડ બદલો.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRINTING (11–30)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 11, category: 'printer',
    keywords: ['connect', 'printer', 'bluetooth', 'ble', 'pair', 'printer connect', 'printer kaise jode'],
    question: {
      en: 'How do I connect a Bluetooth printer?',
      hi: 'ब्लूटूथ प्रिंटर कैसे कनेक्ट करें?',
      mr: 'ब्लूटूथ प्रिंटर कसा जोडायचा?',
      ta: 'புளூடூத் பிரிண்டர் எப்படி இணைப்பது?',
      te: 'బ్లూటూత్ ప్రింటర్ ఎలా కనెక్ట్ చేయాలి?',
      gu: 'બ્લુટૂથ પ્રિન્ટર કેવી રીતે કનેક્ટ કરવું?',
    },
    answer: {
      en: '1. Go to the **Printers** page from the sidebar\n2. In the "Connected Printer" section, click **"Pair New Printer"**\n3. A Bluetooth device picker will appear — select your printer\n4. Once connected, you\'ll see a green "Connected" status with the printer name\n5. The printer will auto-reconnect next time you open the app!\n\n⚠️ Requires Chrome or Edge browser with Web Bluetooth support.',
      hi: '1. साइडबार से **प्रिंटर्स** पेज पर जाएं\n2. "कनेक्टेड प्रिंटर" अनुभाग में, **"नया प्रिंटर जोड़ें"** पर क्लिक करें\n3. ब्लूटूथ डिवाइस पिकर दिखाई देगा — अपना प्रिंटर चुनें\n4. कनेक्ट होने पर, हरा "कनेक्टेड" स्टेटस दिखेगा\n5. अगली बार ऐप खोलने पर प्रिंटर ऑटो-रीकनेक्ट होगा!\n\n⚠️ Web Bluetooth सपोर्ट के लिए Chrome या Edge ब्राउज़र आवश्यक है।',
      mr: '1. साइडबारमधून **प्रिंटर्स** पेजवर जा\n2. "कनेक्टेड प्रिंटर" मध्ये **"नवीन प्रिंटर जोडा"** वर क्लिक करा\n3. ब्लूटूथ डिव्हाइस निवडक दिसेल — तुमचा प्रिंटर निवडा',
      ta: '1. பக்கப்பட்டியில் **அச்சுப்பொறிகள்** பக்கத்திற்கு செல்லவும்\n2. "இணைக்கப்பட்ட அச்சுப்பொறி" பிரிவில் **"புதிய அச்சுப்பொறி இணை"** கிளிக் செய்யவும்',
      te: '1. సైడ్‌బార్ నుండి **ప్రింటర్‌లు** పేజీకి వెళ్ళండి\n2. "కనెక్టెడ్ ప్రింటర్" సెక్షన్‌లో **"కొత్త ప్రింటర్ పేర్ చేయి"** క్లిక్ చేయండి',
      gu: '1. સાઇડબારમાંથી **પ્રિન્ટર્સ** પેજ પર જાઓ\n2. "કનેક્ટેડ પ્રિન્ટર" વિભાગમાં **"નવું પ્રિન્ટર જોડો"** ક્લિક કરો',
    },
  },
  {
    id: 12, category: 'printer',
    keywords: ['receipt', 'print receipt', 'bill', 'bill print', 'thermal', 'raseed'],
    question: {
      en: 'How do I print a receipt / bill?',
      hi: 'रसीद / बिल कैसे प्रिंट करें?',
      mr: 'पावती / बिल कसे प्रिंट करावे?',
      ta: 'ரசீது / பில் எப்படி அச்சிடுவது?',
      te: 'రసీదు / బిల్లు ఎలా ప్రింట్ చేయాలి?',
      gu: 'રસીદ / બિલ કેવી રીતે પ્રિંટ કરવું?',
    },
    answer: {
      en: 'Receipts are printed automatically after completing a sale on the POS page (if "Auto-print on sale" is enabled in Printers settings).\n\nTo print manually:\n1. Go to **Sales** → Click on any sale\n2. Click the **"Print Receipt"** button\n3. If a Bluetooth printer is connected, it prints directly\n4. Otherwise, a browser print dialog opens\n\nCustomize receipt layout on the **Printers** page → Receipt tab.',
      hi: 'POS पेज पर बिक्री पूरी करने के बाद रसीदें ऑटो-प्रिंट होती हैं (अगर प्रिंटर सेटिंग्स में "बिक्री पर ऑटो-प्रिंट" सक्षम है)।\n\nमैन्युअल प्रिंट के लिए:\n1. **बिक्री** → किसी बिक्री पर क्लिक करें\n2. **"रसीद प्रिंट करें"** बटन पर क्लिक करें',
      mr: 'POS पेजवर विक्री पूर्ण केल्यानंतर पावत्या ऑटो-प्रिंट होतात.',
      ta: 'POS பக்கத்தில் விற்பனை முடிந்ததும் ரசீதுகள் தானாக அச்சிடப்படும்.',
      te: 'POS పేజీలో అమ్మకం పూర్తి చేసిన తర్వాత రసీదులు ఆటో-ప్రింట్ అవుతాయి.',
      gu: 'POS પેજ પર વેચાણ પૂર્ણ કર્યા પછી રસીદો ઓટો-પ્રિંટ થાય છે.',
    },
  },
  {
    id: 13, category: 'printer',
    keywords: ['test print', 'check printer', 'printer working', 'test'],
    question: {
      en: 'How do I test if my printer is working?',
      hi: 'प्रिंटर काम कर रहा है या नहीं कैसे जांचें?',
      mr: 'प्रिंटर काम करत आहे का ते कसे तपासायचे?',
      ta: 'அச்சுப்பொறி வேலை செய்கிறதா என்பதை எப்படி சோதிப்பது?',
      te: 'ప్రింటర్ పని చేస్తుందో లేదో ఎలా టెస్ట్ చేయాలి?',
      gu: 'પ્રિન્ટર કામ કરે છે કે નહીં તે કેવી રીતે તપાસવું?',
    },
    answer: {
      en: 'Go to the **Printers** page and click **"Test Print"** at the top. This sends a sample receipt or label (depending on the active tab) to your connected printer.\n\n• Receipt tab → Test receipt with sample items\n• Label tab → Test label with sample product data\n• Invoice tab → Opens browser print preview for A4 invoice',
      hi: '**प्रिंटर्स** पेज पर जाएं और ऊपर **"टेस्ट प्रिंट"** पर क्लिक करें।',
      mr: '**प्रिंटर्स** पेजवर जा आणि **"टेस्ट प्रिंट"** वर क्लिक करा.',
      ta: '**அச்சுப்பொறிகள்** பக்கத்திற்கு சென்று **"சோதனை அச்சு"** கிளிக் செய்யவும்.',
      te: '**ప్రింటర్‌లు** పేజీకి వెళ్లి **"టెస్ట్ ప్రింట్"** క్లిక్ చేయండి.',
      gu: '**પ્રિન્ટર્સ** પેજ પર જાઓ અને **"ટેસ્ટ પ્રિંટ"** ક્લિક કરો.',
    },
  },
  {
    id: 14, category: 'printer',
    keywords: ['paper size', '58mm', '80mm', 'thermal paper', 'paper width'],
    question: {
      en: 'Which paper sizes are supported?',
      hi: 'कौन से पेपर साइज़ सपोर्ट हैं?',
      mr: 'कोणते पेपर आकार समर्थित आहेत?',
      ta: 'எந்த காகித அளவுகள் ஆதரிக்கப்படுகின்றன?',
      te: 'ఏ పేపర్ సైజులు సపోర్ట్ చేయబడతాయి?',
      gu: 'કયા પેપર સાઈઝ સપોર્ટેડ છે?',
    },
    answer: {
      en: 'For thermal receipt printers:\n• **58mm** (2 inch) — Common in small POS printers\n• **80mm** (3 inch) — Standard thermal receipt width\n\nFor label printers:\n• **50mm × 30mm** — Standard barcode sticker labels\n• Custom sizes can be set in the label designer\n\nFor invoices:\n• **A4** (210 × 297mm) — Standard printer paper\n• **A5** and **Letter** sizes supported',
      hi: 'थर्मल रसीद प्रिंटर के लिए:\n• **58mm** (2 इंच)\n• **80mm** (3 इंच)\n\nलेबल प्रिंटर के लिए:\n• **50mm × 30mm** — स्टैंडर्ड बारकोड स्टिकर\n\nइनवॉइस के लिए:\n• **A4** (210 × 297mm)',
      mr: 'थर्मल पावती प्रिंटरसाठी:\n• **58mm** आणि **80mm**\nलेबल प्रिंटरसाठी:\n• **50mm × 30mm**',
      ta: 'வெப்ப ரசீது பிரிண்டர்களுக்கு:\n• **58mm** மற்றும் **80mm**',
      te: 'థర్మల్ రసీదు ప్రింటర్‌లకు:\n• **58mm** మరియు **80mm**',
      gu: 'થર્મલ રસીદ પ્રિન્ટર્સ માટે:\n• **58mm** અને **80mm**',
    },
  },
  {
    id: 15, category: 'printer',
    keywords: ['disconnect', 'unpair', 'remove printer', 'disconnect printer'],
    question: {
      en: 'How do I disconnect a printer?',
      hi: 'प्रिंटर को डिस्कनेक्ट कैसे करें?',
      mr: 'प्रिंटर कसा डिस्कनेक्ट करायचा?',
      ta: 'அச்சுப்பொறியை எப்படி துண்டிப்பது?',
      te: 'ప్రింటర్‌ను ఎలా డిస్‌కనెక్ట్ చేయాలి?',
      gu: 'પ્રિન્ટર કેવી રીતે ડિસ્કનેક્ટ કરવું?',
    },
    answer: {
      en: 'Go to **Printers** page → In the "Connected Printer" section, click the **"Disconnect"** button (🔌 icon). The printer will be disconnected instantly.\n\nTo pair a different printer, click "Pair New Printer" after disconnecting.',
      hi: '**प्रिंटर्स** पेज पर जाएं → "कनेक्टेड प्रिंटर" में **"डिस्कनेक्ट"** बटन पर क्लिक करें।',
      mr: '**प्रिंटर्स** पेजवर जा → **"डिस्कनेक्ट"** बटणावर क्लिक करा.',
      ta: '**அச்சுப்பொறிகள்** பக்கத்திற்கு செல்லவும் → **"துண்டி"** பொத்தானைக் கிளிக் செய்யவும்.',
      te: '**ప్రింటర్‌లు** పేజీకి వెళ్ళండి → **"డిస్‌కనెక్ట్"** బటన్ క్లిక్ చేయండి.',
      gu: '**પ્રિન્ટર્સ** પેજ પર જાઓ → **"ડિસ્કનેક્ટ"** બટન ક્લિક કરો.',
    },
  },
  {
    id: 16, category: 'printer',
    keywords: ['auto print', 'automatic', 'sale print', 'print on sale'],
    question: {
      en: 'Can receipts be printed automatically after every sale?',
      hi: 'क्या हर बिक्री के बाद ऑटो-प्रिंट हो सकती है?',
      mr: 'प्रत्येक विक्रीनंतर पावती ऑटोमॅटिक प्रिंट होऊ शकते का?',
      ta: 'ஒவ்வொரு விற்பனைக்குப் பிறகும் ரசீதுகள் தானாக அச்சிடப்படுமா?',
      te: 'ప్రతి అమ్మకం తర్వాత రసీదులు ఆటోమేటిక్‌గా ప్రింట్ అవుతాయా?',
      gu: 'દરેક વેચાણ પછી રસીદો ઓટોમેટિક પ્રિંટ થઈ શકે?',
    },
    answer: {
      en: 'Yes! Go to **Printers** page → Receipt Settings tab and enable **"Auto-print on sale"** toggle. When enabled, a receipt will automatically print via Bluetooth every time you complete a sale on the POS page.',
      hi: 'हां! **प्रिंटर्स** पेज → रसीद सेटिंग्स टैब पर जाएं और **"बिक्री पर ऑटो-प्रिंट"** टॉगल सक्षम करें।',
      mr: 'होय! **प्रिंटर्स** पेज → पावती सेटिंग्ज टॅबवर जा आणि **"विक्रीवर ऑटो-प्रिंट"** टॉगल सक्षम करा.',
      ta: 'ஆம்! **அச்சுப்பொறிகள்** பக்கம் → ரசீது அமைப்புகள் டேப்பில் **"விற்பனையில் தானாக அச்சிடு"** நிலைமாற்றியை இயக்கவும்.',
      te: 'అవును! **ప్రింటర్‌లు** పేజీ → రసీదు సెట్టింగ్‌ల ట్యాబ్‌లో **"అమ్మకంపై ఆటో-ప్రింట్"** టాగిల్ ఎనేబుల్ చేయండి.',
      gu: 'હા! **પ્રિન્ટર્સ** પેજ → રસીદ સેટિંગ્સ ટેબમાં **"વેચાણ પર ઓટો-પ્રિંટ"** ટૉગલ ઓન કરો.',
    },
  },
  {
    id: 17, category: 'printer',
    keywords: ['receipt customize', 'logo', 'gstin', 'footer', 'header', 'company name'],
    question: {
      en: 'How do I customize the receipt layout?',
      hi: 'रसीद लेआउट को कैसे कस्टमाइज़ करें?',
      mr: 'पावती लेआउट कसा सानुकूलित करायचा?',
      ta: 'ரசீது தளவமைப்பை எப்படி தனிப்பயனாக்குவது?',
      te: 'రసీదు లేఅవుట్‌ను ఎలా కస్టమైజ్ చేయాలి?',
      gu: 'રસીદ લેઆઉટ કેવી રીતે કસ્ટમાઈઝ કરવું?',
    },
    answer: {
      en: 'Go to **Printers** page → **Receipt** tab. You can customize:\n• Company Name & Address\n• Phone Number & GSTIN\n• Logo (show/hide)\n• Footer Message\n• Terms & Conditions lines\n• Paper Width (58mm / 80mm)\n• Font Size (small/medium/large)\n• Show/hide barcode, customer details, etc.\n\nAll changes are saved to the database and persist across sessions.',
      hi: '**प्रिंटर्स** पेज → **रसीद** टैब पर जाएं। आप कस्टमाइज़ कर सकते हैं:\n• कंपनी का नाम और पता\n• फोन नंबर और GSTIN\n• लोगो\n• फुटर मैसेज\n• नियम और शर्तें',
      mr: '**प्रिंटर्स** पेज → **पावती** टॅबवर जा. तुम्ही सानुकूलित करू शकता:\n• कंपनी नाव आणि पत्ता\n• फोन आणि GSTIN\n• लोगो',
      ta: '**அச்சுப்பொறிகள்** பக்கம் → **ரசீது** டேப்புக்கு செல்லவும்.',
      te: '**ప్రింటర్‌లు** పేజీ → **రసీదు** ట్యాబ్‌కి వెళ్ళండి.',
      gu: '**પ્રિન્ટર્સ** પેજ → **રસીદ** ટેબમાં જાઓ.',
    },
  },
  {
    id: 18, category: 'printer',
    keywords: ['tspl', 'escpos', 'esc/pos', 'printer mode', 'label mode', 'gap mode'],
    question: {
      en: 'What is TSPL mode vs ESC/POS mode?',
      hi: 'TSPL मोड और ESC/POS मोड में क्या अंतर है?',
      mr: 'TSPL मोड आणि ESC/POS मोड मध्ये काय फरक आहे?',
      ta: 'TSPL பயன்முறை vs ESC/POS பயன்முறை என்ன?',
      te: 'TSPL మోడ్ vs ESC/POS మోడ్ ఏమిటి?',
      gu: 'TSPL મોડ vs ESC/POS મોડ શું છે?',
    },
    answer: {
      en: '**TSPL Mode** 🏷️ — Used for dedicated label/sticker printers. Sends exact SIZE and GAP commands so the printer knows exactly where each sticker starts and ends. Best for barcode sticker rolls.\n\n**ESC/POS Mode** 🧾 — Used for thermal receipt printers. Prints continuous text/graphics on a paper roll. Best for receipts and bills.\n\nSelect the mode in **Printers** → **Label** tab → "Printer Command Mode" dropdown.',
      hi: '**TSPL मोड** 🏷️ — समर्पित लेबल/स्टिकर प्रिंटर के लिए। सटीक SIZE और GAP कमांड भेजता है।\n\n**ESC/POS मोड** 🧾 — थर्मल रसीद प्रिंटर के लिए। पेपर रोल पर लगातार टेक्स्ट प्रिंट करता है।',
      mr: '**TSPL मोड** 🏷️ — लेबल/स्टिकर प्रिंटरसाठी.\n\n**ESC/POS मोड** 🧾 — थर्मल पावती प्रिंटरसाठी.',
      ta: '**TSPL பயன்முறை** 🏷️ — லேபிள்/ஸ்டிக்கர் பிரிண்டர்களுக்கு.\n\n**ESC/POS பயன்முறை** 🧾 — வெப்ப ரசீது பிரிண்டர்களுக்கு.',
      te: '**TSPL మోడ్** 🏷️ — లేబుల్/స్టిక్కర్ ప్రింటర్‌లకు.\n\n**ESC/POS మోడ్** 🧾 — థర్మల్ రసీదు ప్రింటర్‌లకు.',
      gu: '**TSPL મોડ** 🏷️ — લેબલ/સ્ટીકર પ્રિન્ટર્સ માટે.\n\n**ESC/POS મોડ** 🧾 — થર્મલ રસીદ પ્રિન્ટર્સ માટે.',
    },
  },
  {
    id: 19, category: 'printer',
    keywords: ['calibrate', 'gap', 'gap detect', 'sticker align', 'misalign', 'gap calibration'],
    question: {
      en: 'How do I calibrate the label printer gap sensor?',
      hi: 'लेबल प्रिंटर गैप सेंसर कैसे कैलिब्रेट करें?',
      mr: 'लेबल प्रिंटर गॅप सेन्सर कसा कॅलिब्रेट करायचा?',
      ta: 'லேபிள் பிரிண்டர் இடைவெளி உணர்வியை எப்படி அளவீடு செய்வது?',
      te: 'లేబుల్ ప్రింటర్ గ్యాప్ సెన్సర్ ఎలా కాలిబ్రేట్ చేయాలి?',
      gu: 'લેબલ પ્રિન્ટર ગેપ સેન્સર કેવી રીતે કેલિબ્રેટ કરવું?',
    },
    answer: {
      en: 'If labels are printing misaligned (printing across 2 stickers), you need to calibrate the gap sensor:\n\n1. Go to **Printers** → **Label** tab\n2. Click the **"Calibrate Paper Gap"** button\n3. The printer will feed several labels to detect the gap between stickers\n4. After calibration, labels will align perfectly to single stickers\n\n💡 Do this whenever you change label roll sizes.',
      hi: 'अगर लेबल गलत तरीके से प्रिंट हो रहे हैं:\n1. **प्रिंटर्स** → **लेबल** टैब पर जाएं\n2. **"पेपर गैप कैलिब्रेट करें"** बटन पर क्लिक करें\n3. प्रिंटर कई लेबल फीड करेगा\n4. कैलिब्रेशन के बाद लेबल ठीक से एलाइन होंगे',
      mr: 'लेबल चुकीच्या ठिकाणी प्रिंट होत असल्यास:\n1. **प्रिंटर्स** → **लेबल** टॅबवर जा\n2. **"पेपर गॅप कॅलिब्रेट करा"** वर क्लिक करा',
      ta: 'லேபிள்கள் தவறாக அச்சிடப்பட்டால்:\n1. **அச்சுப்பொறிகள்** → **லேபிள்** டேப்புக்கு செல்லவும்\n2. **"காகித இடைவெளி அளவீடு"** கிளிக் செய்யவும்',
      te: 'లేబుల్‌లు తప్పుగా ప్రింట్ అవుతుంటే:\n1. **ప్రింటర్‌లు** → **లేబుల్** ట్యాబ్‌కి వెళ్ళండి\n2. **"పేపర్ గ్యాప్ కాలిబ్రేట్ చేయి"** క్లిక్ చేయండి',
      gu: 'લેબલ્સ ખોટી રીતે પ્રિંટ થાય તો:\n1. **પ્રિન્ટર્સ** → **લેબલ** ટેબ પર જાઓ\n2. **"પેપર ગેપ કેલિબ્રેટ કરો"** ક્લિક કરો',
    },
  },
  {
    id: 20, category: 'printer',
    keywords: ['printer not working', 'print fail', 'no print', 'print error', 'printer problem'],
    question: {
      en: 'My printer is connected but not printing. What should I do?',
      hi: 'प्रिंटर कनेक्ट है लेकिन प्रिंट नहीं हो रहा। क्या करूं?',
      mr: 'प्रिंटर कनेक्ट आहे पण प्रिंट होत नाही. काय करू?',
      ta: 'அச்சுப்பொறி இணைக்கப்பட்டுள்ளது ஆனால் அச்சிடவில்லை. என்ன செய்வது?',
      te: 'ప్రింటర్ కనెక్ట్ అయింది కానీ ప్రింట్ అవడం లేదు. ఏం చేయాలి?',
      gu: 'પ્રિન્ટર કનેક્ટ છે પણ પ્રિંટ થતું નથી. શું કરવું?',
    },
    answer: {
      en: 'Try these steps:\n1. **Check paper** — Make sure the printer has paper loaded\n2. **Restart printer** — Turn it off and on again\n3. **Disconnect and reconnect** — On the Printers page, disconnect and pair again\n4. **Check mode** — If printing labels, make sure the correct mode (TSPL/ESC-POS) is selected\n5. **Test print** — Try the "Test Print" button\n6. **Browser** — Ensure you\'re using Chrome or Edge\n7. **Distance** — Keep the printer within Bluetooth range (~10m)',
      hi: 'ये कदम आज़माएं:\n1. **पेपर चेक करें** — प्रिंटर में पेपर लोड है या नहीं\n2. **प्रिंटर रीस्टार्ट करें**\n3. **डिस्कनेक्ट करें और फिर से कनेक्ट करें**\n4. **मोड चेक करें** — TSPL/ESC-POS\n5. **टेस्ट प्रिंट** करें',
      mr: 'हे उपाय करून पहा:\n1. पेपर तपासा\n2. प्रिंटर रीस्टार्ट करा\n3. डिस्कनेक्ट करून पुन्हा कनेक्ट करा',
      ta: 'இந்த படிகளை முயற்சிக்கவும்:\n1. காகிதம் சரிபார்க்கவும்\n2. பிரிண்டரை மறுதொடக்கம் செய்யவும்',
      te: 'ఈ దశలు ప్రయత్నించండి:\n1. పేపర్ చెక్ చేయండి\n2. ప్రింటర్ రీస్టార్ట్ చేయండి',
      gu: 'આ પગલાં અજમાવો:\n1. પેપર ચેક કરો\n2. પ્રિન્ટર રીસ્ટાર્ટ કરો',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LABELS & BARCODES (21–35)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 21, category: 'label',
    keywords: ['print label', 'barcode label', 'sticker', 'product label', 'label print'],
    question: {
      en: 'How do I print product labels / barcode stickers?',
      hi: 'प्रोडक्ट लेबल / बारकोड स्टिकर कैसे प्रिंट करें?',
      mr: 'प्रॉडक्ट लेबल / बारकोड स्टिकर कसे प्रिंट करायचे?',
      ta: 'தயாரிப்பு லேபிள்கள் / பார்கோடு ஸ்டிக்கர்கள் எப்படி அச்சிடுவது?',
      te: 'ఉత్పత్తి లేబుల్‌లు / బార్‌కోడ్ స్టిక్కర్‌లు ఎలా ప్రింట్ చేయాలి?',
      gu: 'પ્રોડક્ટ લેબલ / બારકોડ સ્ટીકર્સ કેવી રીતે પ્રિંટ કરવા?',
    },
    answer: {
      en: 'Two ways to print product labels:\n\n**Method 1 — From Products Page:**\nClick the 🏷️ tag icon next to any product in the products list. It prints the label using your saved template.\n\n**Method 2 — From Printers Page:**\n1. Go to **Printers** → **Label** tab\n2. Select a product from the dropdown\n3. Customize the label layout (add/remove elements)\n4. Click **"Test Print"** to print\n\nBoth methods use the same label template you designed!',
      hi: 'प्रोडक्ट लेबल प्रिंट करने के दो तरीके:\n\n**तरीका 1 — प्रोडक्ट्स पेज से:**\nप्रोडक्ट्स लिस्ट में किसी प्रोडक्ट के बगल में 🏷️ टैग आइकन पर क्लिक करें।\n\n**तरीका 2 — प्रिंटर्स पेज से:**\n1. **प्रिंटर्स** → **लेबल** टैब पर जाएं\n2. ड्रॉपडाउन से प्रोडक्ट चुनें\n3. लेबल लेआउट कस्टमाइज़ करें\n4. **"टेस्ट प्रिंट"** करें',
      mr: 'प्रॉडक्ट लेबल प्रिंट करण्याचे दोन मार्ग:\n1. **प्रॉडक्ट्स** पेजवरून 🏷️ आयकॉन क्लिक करा\n2. **प्रिंटर्स** → **लेबल** टॅबवरून',
      ta: 'தயாரிப்பு லேபிள்களை அச்சிட இரண்டு வழிகள்:\n1. **தயாரிப்புகள்** பக்கத்தில் 🏷️ ஐகானை கிளிக் செய்யவும்\n2. **அச்சுப்பொறிகள்** → **லேபிள்** டேப்பிலிருந்து',
      te: 'ఉత్పత్తి లేబుల్‌లను ప్రింట్ చేయడానికి రెండు మార్గాలు:\n1. **ఉత్పత్తులు** పేజీలో 🏷️ ఐకాన్ క్లిక్ చేయండి\n2. **ప్రింటర్‌లు** → **లేబుల్** ట్యాబ్ నుండి',
      gu: 'પ્રોડક્ટ લેબલ પ્રિંટ કરવાની બે રીતો:\n1. **પ્રોડક્ટ્સ** પેજમાં 🏷️ આઈકોન ક્લિક કરો\n2. **પ્રિન્ટર્સ** → **લેબલ** ટેબમાંથી',
    },
  },
  {
    id: 22, category: 'label',
    keywords: ['label design', 'customize label', 'label layout', 'label template', 'label editor'],
    question: {
      en: 'How do I design / customize the label layout?',
      hi: 'लेबल लेआउट कैसे डिज़ाइन / कस्टमाइज़ करें?',
      mr: 'लेबल लेआउट कसे डिझाइन / सानुकूलित करायचे?',
      ta: 'லேபிள் தளவமைப்பை எப்படி வடிவமைப்பது / தனிப்பயனாக்குவது?',
      te: 'లేబుల్ లేఅవుట్ ఎలా డిజైన్ / కస్టమైజ్ చేయాలి?',
      gu: 'લેબલ લેઆઉટ કેવી રીતે ડિઝાઈન / કસ્ટમાઈઝ કરવું?',
    },
    answer: {
      en: 'Go to **Printers** → **Label** tab → **Label Element Builder** section:\n\n• **Add elements** using the dropdown: Business Name, Product Name, Price, Barcode/QR, Custom Text\n• **Reorder** elements using ↑/↓ arrows\n• **Align** each element: Left, Center, or Right\n• **Bold** and **2× Size** toggles for emphasis\n• **Remove** elements with the 🗑️ icon\n• Set label **dimensions** (width × height in mm)\n• Choose **barcode type**: Code 128, EAN-13, or QR Code\n\nThe live preview updates instantly as you make changes!',
      hi: '**प्रिंटर्स** → **लेबल** टैब → **लेबल एलिमेंट बिल्डर** में जाएं:\n\n• ड्रॉपडाउन से **एलिमेंट जोड़ें**\n• ↑/↓ तीरों से **क्रम बदलें**\n• प्रत्येक एलिमेंट **संरेखित** करें\n• **बोल्ड** और **2× साइज़** टॉगल\n• 🗑️ से एलिमेंट **हटाएं**',
      mr: '**प्रिंटर्स** → **लेबल** टॅब → **लेबल एलिमेंट बिल्डर** मध्ये जा.',
      ta: '**அச்சுப்பொறிகள்** → **லேபிள்** டேப் → **லேபிள் உறுப்பு கட்டமைப்பான்** பகுதிக்கு செல்லவும்.',
      te: '**ప్రింటర్‌లు** → **లేబుల్** ట్యాబ్ → **లేబుల్ ఎలిమెంట్ బిల్డర్** సెక్షన్‌కి వెళ్ళండి.',
      gu: '**પ્રિન્ટર્સ** → **લેબલ** ટેબ → **લેબલ એલિમેન્ટ બિલ્ડર** વિભાગમાં જાઓ.',
    },
  },
  {
    id: 23, category: 'label',
    keywords: ['qr code', 'qr', 'scan', 'qr print'],
    question: {
      en: 'Can I print QR codes on labels?',
      hi: 'क्या मैं लेबल पर QR कोड प्रिंट कर सकता हूँ?',
      mr: 'लेबलवर QR कोड प्रिंट करता येतो का?',
      ta: 'லேபிள்களில் QR குறியீடுகளை அச்சிட முடியுமா?',
      te: 'లేబుల్‌లపై QR కోడ్‌లు ప్రింట్ చేయగలనా?',
      gu: 'લેબલ પર QR કોડ પ્રિંટ કરી શકાય?',
    },
    answer: {
      en: 'Yes! In the Label designer (**Printers** → **Label** tab):\n1. Change the "Barcode Type" dropdown to **"QR Code"**\n2. Add a "Barcode / QR" element to your label template\n3. The QR code will contain the product\'s barcode or SKU value\n4. It\'s scannable with any QR code scanner!\n\nWe also support Code 128 and EAN-13 1D barcodes.',
      hi: 'हां! लेबल डिज़ाइनर में (**प्रिंटर्स** → **लेबल** टैब):\n1. "बारकोड टाइप" ड्रॉपडाउन को **"QR कोड"** में बदलें\n2. लेबल टेम्प्लेट में "बारकोड / QR" एलिमेंट जोड़ें',
      mr: 'होय! लेबल डिझायनरमध्ये "बारकोड प्रकार" **"QR कोड"** मध्ये बदला.',
      ta: 'ஆம்! லேபிள் வடிவமைப்பில் "பார்கோடு வகை" **"QR குறியீடு"** ஆக மாற்றவும்.',
      te: 'అవును! లేబుల్ డిజైనర్‌లో "బార్‌కోడ్ టైప్" **"QR కోడ్"** గా మార్చండి.',
      gu: 'હા! લેબલ ડિઝાઈનરમાં "બારકોડ ટાઈપ" **"QR કોડ"** માં બદલો.',
    },
  },
  {
    id: 24, category: 'label',
    keywords: ['label size', 'sticker size', '50x30', 'label dimension', 'mm'],
    question: {
      en: 'How do I change the label size?',
      hi: 'लेबल का साइज़ कैसे बदलें?',
      mr: 'लेबल आकार कसा बदलायचा?',
      ta: 'லேபிள் அளவை எப்படி மாற்றுவது?',
      te: 'లేబుల్ సైజు ఎలా మార్చాలి?',
      gu: 'લેબલ સાઈઝ કેવી રીતે બદલવી?',
    },
    answer: {
      en: 'Go to **Printers** → **Label** tab. At the top you\'ll see Width and Height input fields (in mm). The default is **50mm × 30mm** which fits standard barcode sticker rolls.\n\nCommon label sizes:\n• 50 × 30 mm — Standard barcode labels\n• 40 × 25 mm — Small labels\n• 100 × 50 mm — Shipping labels\n\nThe live preview updates in real-time when you change sizes.',
      hi: '**प्रिंटर्स** → **लेबल** टैब पर जाएं। ऊपर चौड़ाई और ऊंचाई इनपुट फील्ड (mm में) दिखेंगे। डिफ़ॉल्ट **50mm × 30mm** है।',
      mr: '**प्रिंटर्स** → **लेबल** टॅबवर जा. रुंदी आणि उंची (mm मध्ये) बदला.',
      ta: '**அச்சுப்பொறிகள்** → **லேபிள்** டேப்பில் அகலம் மற்றும் உயரம் (mm) மாற்றவும்.',
      te: '**ప్రింటర్‌లు** → **లేబుల్** ట్యాబ్‌లో వెడల్పు మరియు ఎత్తు (mm) మార్చండి.',
      gu: '**પ્રિન્ટર્સ** → **લેબલ** ટેબમાં પહોળાઈ અને ઊંચાઈ (mm) બદલો.',
    },
  },
  {
    id: 25, category: 'label',
    keywords: ['barcode', 'code128', 'ean13', 'barcode type'],
    question: {
      en: 'What barcode formats are supported?',
      hi: 'कौन से बारकोड फॉर्मेट सपोर्ट हैं?',
      mr: 'कोणते बारकोड फॉरमॅट समर्थित आहेत?',
      ta: 'என்ன பார்கோடு வடிவங்கள் ஆதரிக்கப்படுகின்றன?',
      te: 'ఏ బార్‌కోడ్ ఫార్మాట్‌లు సపోర్ట్ చేయబడతాయి?',
      gu: 'કયા બારકોડ ફોર્મેટ સપોર્ટેડ છે?',
    },
    answer: {
      en: 'We support three barcode symbologies:\n\n1. **Code 128** — Versatile, supports alphanumeric characters. Most commonly used for general retail barcodes.\n2. **EAN-13** — The standard 13-digit European product barcode. Used globally for retail products.\n3. **QR Code** — 2D barcode that can encode longer data like URLs, product IDs, etc.\n\nSelect your preferred type in **Printers** → **Label** tab → "Barcode Type".',
      hi: 'हम तीन बारकोड प्रकारों का समर्थन करते हैं:\n1. **Code 128** — सामान्य बारकोड\n2. **EAN-13** — 13-अंकीय उत्पाद बारकोड\n3. **QR Code** — 2D बारकोड',
      mr: 'तीन बारकोड प्रकार समर्थित:\n1. **Code 128**\n2. **EAN-13**\n3. **QR Code**',
      ta: 'மூன்று பார்கோடு வகைகள்:\n1. **Code 128**\n2. **EAN-13**\n3. **QR Code**',
      te: 'మూడు బార్‌కోడ్ రకాలు:\n1. **Code 128**\n2. **EAN-13**\n3. **QR Code**',
      gu: 'ત્રણ બારકોડ પ્રકારો:\n1. **Code 128**\n2. **EAN-13**\n3. **QR Code**',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS (26–40)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 26, category: 'products',
    keywords: ['add product', 'new product', 'create product', 'product add', 'product banaye'],
    question: {
      en: 'How do I add a new product?',
      hi: 'नया प्रोडक्ट कैसे जोड़ें?',
      mr: 'नवीन प्रॉडक्ट कसे जोडायचे?',
      ta: 'புதிய தயாரிப்பை எப்படி சேர்ப்பது?',
      te: 'కొత్త ఉత్పత్తి ఎలా జోడించాలి?',
      gu: 'નવું પ્રોડક્ટ કેવી રીતે ઉમેરવું?',
    },
    answer: {
      en: '1. Go to **Products** page from the sidebar\n2. Click the **"+ Add Product"** button\n3. Fill in the details:\n   • Product Name\n   • Category\n   • Cost Price & Selling Price\n   • Tax Rate (GST %)\n   • Current Stock & Low Stock Threshold\n   • Barcode (optional)\n   • Image (optional)\n4. Click **"Save"**\n\nA unique SKU is automatically generated!',
      hi: '1. साइडबार से **प्रोडक्ट्स** पेज पर जाएं\n2. **"+ प्रोडक्ट जोड़ें"** बटन पर क्लिक करें\n3. विवरण भरें\n4. **"सेव"** क्लिक करें',
      mr: '1. साइडबारमधून **प्रॉडक्ट्स** पेजवर जा\n2. **"+ प्रॉडक्ट जोडा"** वर क्लिक करा\n3. माहिती भरा\n4. **"सेव्ह"** करा',
      ta: '1. பக்கப்பட்டியில் **தயாரிப்புகள்** பக்கத்திற்கு செல்லவும்\n2. **"+ தயாரிப்பு சேர்"** கிளிக் செய்யவும்',
      te: '1. సైడ్‌బార్ నుండి **ఉత్పత్తులు** పేజీకి వెళ్ళండి\n2. **"+ ఉత్పత్తి జోడించు"** క్లిక్ చేయండి',
      gu: '1. સાઇડબારથી **પ્રોડક્ટ્સ** પેજ પર જાઓ\n2. **"+ પ્રોડક્ટ ઉમેરો"** ક્લિક કરો',
    },
  },
  {
    id: 27, category: 'products',
    keywords: ['stock', 'inventory', 'stock update', 'adjust stock', 'stock level'],
    question: {
      en: 'How do I update product stock?',
      hi: 'प्रोडक्ट स्टॉक कैसे अपडेट करें?',
      mr: 'प्रॉडक्ट स्टॉक कसा अपडेट करायचा?',
      ta: 'தயாரிப்பு சரக்கை எப்படி புதுப்பிப்பது?',
      te: 'ఉత్పత్తి స్టాక్ ఎలా అప్‌డేట్ చేయాలి?',
      gu: 'પ્રોડક્ટ સ્ટૉક કેવી રીતે અપડેટ કરવો?',
    },
    answer: {
      en: 'Stock updates automatically when you make sales via POS. To manually adjust:\n\n1. Go to **Products** page\n2. Click on a product to edit it\n3. Update the "Current Stock" field\n4. Save changes\n\nYou can also use the **Barcode Stock Scanner** to quickly update stock by scanning product barcodes.',
      hi: 'POS से बिक्री करने पर स्टॉक ऑटोमेटिक अपडेट होता है। मैन्युअल एडजस्ट करने के लिए:\n1. **प्रोडक्ट्स** पेज पर जाएं\n2. प्रोडक्ट पर क्लिक करें\n3. "वर्तमान स्टॉक" अपडेट करें\n4. सेव करें',
      mr: 'POS वरून विक्री केल्यावर स्टॉक ऑटोमॅटिक अपडेट होतो.',
      ta: 'POS வழியாக விற்பனை செய்யும்போது சரக்கு தானாக புதுப்பிக்கப்படும்.',
      te: 'POS ద్వారా అమ్మకం చేసినప్పుడు స్టాక్ ఆటోమేటిక్‌గా అప్‌డేట్ అవుతుంది.',
      gu: 'POS થી વેચાણ કરતા સ્ટૉક ઓટોમેટિક અપડેટ થાય છે.',
    },
  },
  {
    id: 28, category: 'products',
    keywords: ['low stock', 'alert', 'notification', 'stock warning', 'kam stock'],
    question: {
      en: 'How do low stock alerts work?',
      hi: 'कम स्टॉक अलर्ट कैसे काम करते हैं?',
      mr: 'कमी स्टॉक अलर्ट कसे कार्य करतात?',
      ta: 'குறைந்த சரக்கு எச்சரிக்கைகள் எப்படி வேலை செய்கின்றன?',
      te: 'తక్కువ స్టాక్ అలర్ట్‌లు ఎలా పని చేస్తాయి?',
      gu: 'ઓછા સ્ટૉક એલર્ટ્સ કેવી રીતે કામ કરે છે?',
    },
    answer: {
      en: 'Each product has a "Low Stock Threshold" value. When the current stock falls below this number:\n• The product shows an **amber warning** badge in the Products list\n• An alert appears on the **Dashboard**\n• Products at zero stock show a **red "Out of Stock"** badge\n\nSet the threshold when creating/editing a product (default is usually 10 units).',
      hi: 'प्रत्येक प्रोडक्ट में "कम स्टॉक थ्रेशोल्ड" वैल्यू होती है। जब स्टॉक इससे नीचे गिरता है:\n• प्रोडक्ट्स लिस्ट में चेतावनी बैज दिखता है\n• डैशबोर्ड पर अलर्ट दिखाई देता है',
      mr: 'प्रत्येक प्रॉडक्टला "कमी स्टॉक थ्रेशोल्ड" असतो.',
      ta: 'ஒவ்வொரு தயாரிப்புக்கும் "குறைந்த சரக்கு எல்லை" உள்ளது.',
      te: 'ప్రతి ఉత్పత్తికి "తక్కువ స్టాక్ థ్రెషోల్డ్" విలువ ఉంటుంది.',
      gu: 'દરેક પ્રોડક્ટમાં "ઓછા સ્ટૉક થ્રેશોલ્ડ" વેલ્યુ હોય છે.',
    },
  },
  {
    id: 29, category: 'products',
    keywords: ['category', 'add category', 'product category'],
    question: {
      en: 'How do I create product categories?',
      hi: 'प्रोडक्ट कैटेगरी कैसे बनाएं?',
      mr: 'प्रॉडक्ट श्रेणी कशी तयार करायची?',
      ta: 'தயாரிப்பு வகைகளை எப்படி உருவாக்குவது?',
      te: 'ఉత్పత్తి వర్గాలను ఎలా సృష్టించాలి?',
      gu: 'પ્રોડક્ટ કેટેગરી કેવી રીતે બનાવવી?',
    },
    answer: {
      en: '1. Go to **Categories** page from the sidebar\n2. Click **"+ Add Category"**\n3. Enter a name (e.g., "Electronics", "Groceries", "Stationery")\n4. Click Save\n\nCategories help organize your products and appear in the product creation form as a dropdown.',
      hi: '1. साइडबार से **कैटेगरी** पेज पर जाएं\n2. **"+ कैटेगरी जोड़ें"** पर क्लिक करें\n3. नाम दर्ज करें\n4. सेव करें',
      mr: '1. **श्रेणी** पेजवर जा\n2. **"+ श्रेणी जोडा"** वर क्लिक करा',
      ta: '1. **வகைகள்** பக்கத்திற்கு செல்லவும்\n2. **"+ வகை சேர்"** கிளிக் செய்யவும்',
      te: '1. **వర్గాలు** పేజీకి వెళ్ళండి\n2. **"+ వర్గం జోడించు"** క్లిక్ చేయండి',
      gu: '1. **કેટેગરી** પેજ પર જાઓ\n2. **"+ કેટેગરી ઉમેરો"** ક્લિક કરો',
    },
  },
  {
    id: 30, category: 'products',
    keywords: ['delete product', 'remove product', 'bulk delete'],
    question: {
      en: 'How do I delete products?',
      hi: 'प्रोडक्ट कैसे डिलीट करें?',
      mr: 'प्रॉडक्ट कसे हटवायचे?',
      ta: 'தயாரிப்புகளை எப்படி நீக்குவது?',
      te: 'ఉత్పత్తులను ఎలా డిలీట్ చేయాలి?',
      gu: 'પ્રોડક્ટ કેવી રીતે ડિલીટ કરવું?',
    },
    answer: {
      en: 'Go to **Products** page:\n\n**Single delete:** Click the checkbox next to a product, then click the 🗑️ Delete button.\n\n**Bulk delete:** Select multiple products using checkboxes, then click "Delete Selected". A confirmation dialog will appear.\n\nDeleted products are soft-deleted and won\'t appear in active lists.',
      hi: '**प्रोडक्ट्स** पेज पर:\n• **एक डिलीट:** चेकबॉक्स चुनें, फिर 🗑️ डिलीट बटन पर क्लिक करें\n• **बल्क डिलीट:** कई प्रोडक्ट चुनें और "चयनित हटाएं" क्लिक करें',
      mr: '**प्रॉडक्ट्स** पेजवर चेकबॉक्स निवडा आणि 🗑️ हटवा.',
      ta: '**தயாரிப்புகள்** பக்கத்தில் சரிபார்ப்புப் பெட்டியை தேர்ந்தெடுத்து 🗑️ நீக்கவும்.',
      te: '**ఉత్పత్తులు** పేజీలో చెక్‌బాక్స్ ఎంచుకుని 🗑️ డిలీట్ చేయండి.',
      gu: '**પ્રોડક્ટ્સ** પેજમાં ચેકબોક્સ પસંદ કરો અને 🗑️ ડિલીટ કરો.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POS (31–40)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 31, category: 'pos',
    keywords: ['pos', 'sell', 'sale', 'billing', 'point of sale', 'bikri', 'bechna'],
    question: {
      en: 'How do I make a sale using POS?',
      hi: 'POS से बिक्री कैसे करें?',
      mr: 'POS वापरून विक्री कशी करायची?',
      ta: 'POS பயன்படுத்தி விற்பனை எப்படி செய்வது?',
      te: 'POS ఉపయోగించి అమ్మకం ఎలా చేయాలి?',
      gu: 'POS વાપરીને વેચાણ કેવી રીતે કરવું?',
    },
    answer: {
      en: '1. Go to **POS** from the sidebar\n2. Search for a product or scan its barcode\n3. Click on the product to add it to the cart\n4. Adjust quantity using +/- buttons\n5. Select a customer (optional)\n6. Choose payment method (Cash / Card / UPI)\n7. Click **"Complete Sale"**\n8. Receipt prints automatically if enabled!\n\nYou can also use **POS Lite** for a simplified interface.',
      hi: '1. साइडबार से **POS** पर जाएं\n2. प्रोडक्ट खोजें या बारकोड स्कैन करें\n3. कार्ट में जोड़ने के लिए क्लिक करें\n4. +/- से मात्रा एडजस्ट करें\n5. ग्राहक चुनें (वैकल्पिक)\n6. भुगतान विधि चुनें\n7. **"बिक्री पूरी करें"** क्लिक करें',
      mr: '1. **POS** वर जा\n2. प्रॉडक्ट शोधा किंवा बारकोड स्कॅन करा\n3. कार्टमध्ये जोडा\n4. "विक्री पूर्ण करा" वर क्लिक करा',
      ta: '1. **POS** செல்லவும்\n2. தயாரிப்பு தேடவும் அல்லது பார்கோடு ஸ்கேன் செய்யவும்\n3. கூடையில் சேர்க்கவும்\n4. "விற்பனை நிறைவு" கிளிக் செய்யவும்',
      te: '1. **POS** కి వెళ్ళండి\n2. ఉత్పత్తి సెర్చ్ చేయండి లేదా బార్‌కోడ్ స్కాన్ చేయండి\n3. కార్ట్‌కి జోడించండి\n4. "అమ్మకం పూర్తి చేయి" క్లిక్ చేయండి',
      gu: '1. **POS** પર જાઓ\n2. પ્રોડક્ટ શોધો અથવા બારકોડ સ્કેન કરો\n3. કાર્ટમાં ઉમેરો\n4. "વેચાણ પૂર્ણ કરો" ક્લિક કરો',
    },
  },
  {
    id: 32, category: 'pos',
    keywords: ['pos lite', 'simple pos', 'easy pos', 'quick sale'],
    question: {
      en: 'What is POS Lite?',
      hi: 'POS Lite क्या है?',
      mr: 'POS Lite काय आहे?',
      ta: 'POS Lite என்றால் என்ன?',
      te: 'POS Lite అంటే ఏమిటి?',
      gu: 'POS Lite શું છે?',
    },
    answer: {
      en: 'POS Lite is a simplified, faster version of the full POS page. It\'s designed for quick sales with:\n• Streamlined product search\n• One-click add to cart\n• Fewer fields to fill\n• Optimized for touch screens & mobile\n\nPerfect for busy checkout counters where speed matters most!',
      hi: 'POS Lite पूर्ण POS पेज का एक सरल, तेज़ संस्करण है। तेज़ बिक्री के लिए डिज़ाइन किया गया है।',
      mr: 'POS Lite हे पूर्ण POS चे सोपे, जलद आवृत्ती आहे.',
      ta: 'POS Lite என்பது முழு POS பக்கத்தின் எளிமையான, வேகமான பதிப்பு.',
      te: 'POS Lite అనేది పూర్తి POS పేజీ యొక్క సరళమైన, వేగవంతమైన వెర్షన్.',
      gu: 'POS Lite એ સંપૂર્ણ POS પેજનું સરળ, ઝડપી વર્ઝન છે.',
    },
  },
  {
    id: 33, category: 'pos',
    keywords: ['payment', 'cash', 'card', 'upi', 'payment method'],
    question: {
      en: 'What payment methods are supported?',
      hi: 'कौन से भुगतान तरीके सपोर्ट हैं?',
      mr: 'कोणत्या पेमेंट पद्धती समर्थित आहेत?',
      ta: 'என்ன கட்டண முறைகள் ஆதரிக்கப்படுகின்றன?',
      te: 'ఏ చెల్లింపు పద్ధతులు సపోర్ట్ చేయబడతాయి?',
      gu: 'કયા પેમેન્ટ મેથડ સપોર્ટેડ છે?',
    },
    answer: {
      en: 'The POS supports three payment methods:\n• 💵 **Cash** — Manual cash payment\n• 💳 **Card** — Credit/Debit card\n• 📱 **UPI** — Digital payment (GPay, PhonePe, etc.)\n\nThe payment method is recorded with each sale for accurate reporting.',
      hi: 'POS तीन भुगतान तरीकों का समर्थन करता है:\n• 💵 **नकद**\n• 💳 **कार्ड**\n• 📱 **UPI**',
      mr: 'POS तीन पेमेंट पद्धतींना समर्थन देतो:\n• 💵 **रोख**\n• 💳 **कार्ड**\n• 📱 **UPI**',
      ta: 'POS மூன்று கட்டண முறைகளை ஆதரிக்கிறது:\n• 💵 **பணம்**\n• 💳 **அட்டை**\n• 📱 **UPI**',
      te: 'POS మూడు చెల్లింపు పద్ధతులను సపోర్ట్ చేస్తుంది:\n• 💵 **నగదు**\n• 💳 **కార్డ్**\n• 📱 **UPI**',
      gu: 'POS ત્રણ પેમેન્ટ પદ્ધતિ સપોર્ટ કરે છે:\n• 💵 **રોકડ**\n• 💳 **કાર્ડ**\n• 📱 **UPI**',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES & REPORTS (34–45)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 34, category: 'sales',
    keywords: ['sales history', 'past sales', 'sale list', 'view sales'],
    question: {
      en: 'Where can I see my sales history?',
      hi: 'बिक्री इतिहास कहां देख सकता हूं?',
      mr: 'विक्री इतिहास कुठे पाहता येतो?',
      ta: 'விற்பனை வரலாற்றை எங்கே பார்ப்பது?',
      te: 'అమ్మకాల చరిత్ర ఎక్కడ చూడగలను?',
      gu: 'વેચાણ ઇતિહાસ ક્યાં જોઈ શકાય?',
    },
    answer: {
      en: 'Go to **Sales** from the sidebar. You\'ll see a list of all completed sales with:\n• Date & Time\n• Customer Name\n• Total Amount\n• Payment Method\n• Number of Items\n\nClick on any sale to see full details (items, quantities, prices) and reprint the receipt.',
      hi: 'साइडबार से **बिक्री** पर जाएं। आपको सभी पूर्ण बिक्री की सूची दिखेगी।',
      mr: 'साइडबारमधून **विक्री** वर जा. सर्व पूर्ण झालेल्या विक्रींची यादी दिसेल.',
      ta: 'பக்கப்பட்டியில் **விற்பனை** செல்லவும்.',
      te: 'సైడ్‌బార్ నుండి **అమ్మకాలు** కి వెళ్ళండి.',
      gu: 'સાઇડબારથી **વેચાણ** પર જાઓ.',
    },
  },
  {
    id: 35, category: 'sales',
    keywords: ['report', 'sales report', 'analytics', 'data', 'revenue'],
    question: {
      en: 'How do I view sales reports?',
      hi: 'बिक्री रिपोर्ट कैसे देखें?',
      mr: 'विक्री अहवाल कसा पाहायचा?',
      ta: 'விற்பனை அறிக்கைகளை எப்படி பார்ப்பது?',
      te: 'అమ్మకాల నివేదికలు ఎలా చూడాలి?',
      gu: 'વેચાણ રિપોર્ટ કેવી રીતે જોવું?',
    },
    answer: {
      en: 'Go to **Reports** from the sidebar. Available reports:\n\n📊 **Sales Report** — Daily/weekly/monthly sales trends\n💰 **Profit & Loss** — Revenue vs costs analysis\n🧾 **Tax Report** — GST summary for filing\n\nEach report includes charts, summary cards, and date range filters.',
      hi: 'साइडबार से **रिपोर्ट** पर जाएं। उपलब्ध रिपोर्ट:\n• बिक्री रिपोर्ट\n• लाभ और हानि\n• टैक्स रिपोर्ट',
      mr: '**रिपोर्ट्स** वर जा. उपलब्ध अहवाल:\n• विक्री अहवाल\n• नफा आणि तोटा\n• कर अहवाल',
      ta: '**அறிக்கைகள்** செல்லவும். கிடைக்கும் அறிக்கைகள்:\n• விற்பனை அறிக்கை\n• லாபம் & நஷ்டம்\n• வரி அறிக்கை',
      te: '**నివేదికలు** కి వెళ్ళండి. అందుబాటులో ఉన్న నివేదికలు:\n• అమ్మకాల నివేదిక\n• లాభం & నష్టం\n• పన్ను నివేదిక',
      gu: '**રિપોર્ટ્સ** પર જાઓ. ઉપલબ્ધ રિપોર્ટ:\n• વેચાણ રિપોર્ટ\n• નફો અને નુકસાન\n• ટેક્સ રિપોર્ટ',
    },
  },
  {
    id: 36, category: 'sales',
    keywords: ['gst', 'tax', 'tax report', 'gstin', 'tax filing'],
    question: {
      en: 'How does GST/tax reporting work?',
      hi: 'GST/टैक्स रिपोर्टिंग कैसे काम करती है?',
      mr: 'GST/कर अहवाल कसा कार्य करतो?',
      ta: 'GST/வரி அறிக்கையிடல் எப்படி வேலை செய்கிறது?',
      te: 'GST/పన్ను రిపోర్టింగ్ ఎలా పని చేస్తుంది?',
      gu: 'GST/ટેક્સ રિપોર્ટિંગ કેવી રીતે કામ કરે છે?',
    },
    answer: {
      en: 'Each product has a configurable GST tax rate (%). When sales are made, the tax is automatically calculated. Go to **Reports** → **Tax Report** to see:\n\n• Total taxable amount\n• GST collected (CGST + SGST / IGST)\n• Tax breakdown by rate slab\n• Date range filter for filing periods\n\nYour GSTIN displays on receipts and invoices when enabled.',
      hi: 'प्रत्येक प्रोडक्ट में GST टैक्स दर (%) सेट होती है। बिक्री पर टैक्स ऑटो-कैलकुलेट होता है। **रिपोर्ट** → **टैक्स रिपोर्ट** पर जाएं।',
      mr: 'प्रत्येक प्रॉडक्टला GST दर (%) असतो. विक्रीवर कर ऑटो-कॅल्क्युलेट होतो.',
      ta: 'ஒவ்வொரு தயாரிப்புக்கும் GST வரி விகிதம் (%) உள்ளது.',
      te: 'ప్రతి ఉత్పత్తికి GST పన్ను రేటు (%) ఉంటుంది.',
      gu: 'દરેક પ્રોડક્ટમાં GST ટેક્સ રેટ (%) હોય છે.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMERS (37–42)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 37, category: 'customers',
    keywords: ['customer', 'add customer', 'new customer', 'grahak'],
    question: {
      en: 'How do I add a customer?',
      hi: 'ग्राहक कैसे जोड़ें?',
      mr: 'ग्राहक कसा जोडायचा?',
      ta: 'வாடிக்கையாளரை எப்படி சேர்ப்பது?',
      te: 'కస్టమర్‌ను ఎలా జోడించాలి?',
      gu: 'ગ્રાહક કેવી રીતે ઉમેરવો?',
    },
    answer: {
      en: '1. Go to **Customers** from the sidebar\n2. Click **"+ Add Customer"**\n3. Enter their details: Name, Phone, Email, Address\n4. Save\n\nCustomers can then be selected during POS sales to link purchases to their account.',
      hi: '1. **ग्राहक** पेज पर जाएं\n2. **"+ ग्राहक जोड़ें"** पर क्लिक करें\n3. विवरण दर्ज करें\n4. सेव करें',
      mr: '1. **ग्राहक** पेजवर जा\n2. **"+ ग्राहक जोडा"** वर क्लिक करा',
      ta: '1. **வாடிக்கையாளர்கள்** பக்கத்திற்கு செல்லவும்\n2. **"+ வாடிக்கையாளர் சேர்"** கிளிக் செய்யவும்',
      te: '1. **కస్టమర్‌లు** పేజీకి వెళ్ళండి\n2. **"+ కస్టమర్ జోడించు"** క్లిక్ చేయండి',
      gu: '1. **ગ્રાહકો** પેજ પર જાઓ\n2. **"+ ગ્રાહક ઉમેરો"** ક્લિક કરો',
    },
  },
  {
    id: 38, category: 'customers',
    keywords: ['credit', 'udhar', 'customer credit', 'due amount', 'pending'],
    question: {
      en: 'How do credits / customer dues work?',
      hi: 'उधार / ग्राहक बकाया कैसे काम करता है?',
      mr: 'उधारी / ग्राहक बाकी कसे कार्य करते?',
      ta: 'கடன் / வாடிக்கையாளர் நிலுவைகள் எப்படி வேலை செய்கின்றன?',
      te: 'క్రెడిట్ / కస్టమర్ బకాయిలు ఎలా పని చేస్తాయి?',
      gu: 'ઉધાર / ગ્રાહક બાકી કેવી રીતે કામ કરે છે?',
    },
    answer: {
      en: 'Go to **Credits** from the sidebar to manage customer dues:\n• View all customers with pending amounts\n• Record payments against credit\n• Track credit history per customer\n• See overdue amounts highlighted\n\nCredits are also visible on individual customer detail pages.',
      hi: 'उधार प्रबंधित करने के लिए साइडबार से **क्रेडिट** पर जाएं।',
      mr: 'उधारी व्यवस्थापित करण्यासाठी **क्रेडिट** वर जा.',
      ta: 'கடன்களை நிர்வகிக்க **கடன்கள்** பக்கத்திற்கு செல்லவும்.',
      te: 'క్రెడిట్‌లను నిర్వహించడానికి **క్రెడిట్‌లు** కి వెళ్ళండి.',
      gu: 'ઉધાર મેનેજ કરવા **ક્રેડિટ્સ** પર જાઓ.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS (39–45)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 39, category: 'settings',
    keywords: ['settings', 'business info', 'company info', 'profile', 'gstin'],
    question: {
      en: 'How do I update my business information?',
      hi: 'अपनी व्यापार जानकारी कैसे अपडेट करें?',
      mr: 'व्यवसाय माहिती कशी अपडेट करायची?',
      ta: 'வணிக தகவலை எப்படி புதுப்பிப்பது?',
      te: 'వ్యాపార సమాచారాన్ని ఎలా అప్‌డేట్ చేయాలి?',
      gu: 'વ્યવસાય માહિતી કેવી રીતે અપડેટ કરવી?',
    },
    answer: {
      en: 'Go to **Settings** from the sidebar → **Business Profile** section. You can update:\n• Business Name\n• Address\n• Phone Number\n• GSTIN\n• Logo URL\n\nThese details appear on all receipts, invoices, and label prints.',
      hi: '**सेटिंग्स** → **बिजनेस प्रोफाइल** में जाएं। अपडेट करें:\n• व्यापार का नाम\n• पता\n• फोन\n• GSTIN\n• लोगो',
      mr: '**सेटिंग्ज** → **व्यवसाय प्रोफाइल** मध्ये जा.',
      ta: '**அமைப்புகள்** → **வணிக விவரக்குறிப்பு** பகுதிக்கு செல்லவும்.',
      te: '**సెట్టింగ్‌లు** → **వ్యాపార ప్రొఫైల్** సెక్షన్‌కి వెళ్ళండి.',
      gu: '**સેટિંગ્સ** → **બિઝનેસ પ્રોફાઈલ** વિભાગમાં જાઓ.',
    },
  },
  {
    id: 40, category: 'settings',
    keywords: ['dark mode', 'theme', 'night mode', 'light mode'],
    question: {
      en: 'How do I enable dark mode?',
      hi: 'डार्क मोड कैसे चालू करें?',
      mr: 'डार्क मोड कसा सुरू करायचा?',
      ta: 'இருண்ட பயன்முறையை எப்படி இயக்குவது?',
      te: 'డార్క్ మోడ్ ఎలా ఎనేబుల్ చేయాలి?',
      gu: 'ડાર્ક મોડ કેવી રીતે ચાલુ કરવો?',
    },
    answer: {
      en: 'Click the 🌙/☀️ theme toggle icon in the top navigation bar. The app instantly switches between:\n• ☀️ **Light Mode** — Bright, clean interface\n• 🌙 **Dark Mode** — Easy on the eyes, perfect for low-light environments\n\nYour preference is saved and persists across sessions.',
      hi: 'टॉप नेविगेशन बार में 🌙/☀️ थीम टॉगल आइकन पर क्लिक करें।',
      mr: 'शीर्ष नॅव्हिगेशन बारमध्ये 🌙/☀️ थीम टॉगल आयकॉनवर क्लिक करा.',
      ta: 'மேல் வழிசெலுத்தல் பட்டியில் 🌙/☀️ தீம் நிலைமாற்றி ஐகானைக் கிளிக் செய்யவும்.',
      te: 'టాప్ నావిగేషన్ బార్‌లో 🌙/☀️ థీమ్ టాగిల్ ఐకాన్ క్లిక్ చేయండి.',
      gu: 'ટોપ નેવિગેશન બારમાં 🌙/☀️ થીમ ટૉગલ આઈકોન ક્લિક કરો.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BILLING & INVOICES (41–50)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 41, category: 'billing',
    keywords: ['invoice', 'a4', 'full invoice', 'formal invoice', 'challan'],
    question: {
      en: 'How do I generate a full A4 invoice?',
      hi: 'पूर्ण A4 इनवॉइस कैसे बनाएं?',
      mr: 'पूर्ण A4 इनव्हॉइस कसा तयार करायचा?',
      ta: 'முழு A4 விலைப்பட்டியல் எப்படி உருவாக்குவது?',
      te: 'పూర్తి A4 ఇన్‌వాయిస్ ఎలా జనరేట్ చేయాలి?',
      gu: 'સંપૂર્ણ A4 ઇન્વોઈસ કેવી રીતે જનરેટ કરવું?',
    },
    answer: {
      en: 'Go to **Printers** → **Invoice** tab. You can:\n• Choose a color theme (Navy, Emerald, Slate, Royal Blue)\n• Toggle header, terms & conditions\n• Add UPI Payment QR code\n• Customize terms text\n\nTo print: Click "Test Print" → Opens browser print dialog for A4/Letter paper.\n\nYou can also print invoices from the Sales detail page.',
      hi: '**प्रिंटर्स** → **इनवॉइस** टैब पर जाएं। आप कलर थीम चुन सकते हैं और नियम व शर्तें कस्टमाइज़ कर सकते हैं।',
      mr: '**प्रिंटर्स** → **इनव्हॉइस** टॅबवर जा.',
      ta: '**அச்சுப்பொறிகள்** → **விலைப்பட்டியல்** டேப்புக்கு செல்லவும்.',
      te: '**ప్రింటర్‌లు** → **ఇన్‌వాయిస్** ట్యాబ్‌కి వెళ్ళండి.',
      gu: '**પ્રિન્ટર્સ** → **ઈન્વોઈસ** ટેબમાં જાઓ.',
    },
  },
  {
    id: 42, category: 'billing',
    keywords: ['supplier', 'purchase', 'purchase order', 'vendor'],
    question: {
      en: 'How do I manage purchases from suppliers?',
      hi: 'आपूर्तिकर्ताओं से खरीदारी कैसे प्रबंधित करें?',
      mr: 'पुरवठादारांकडून खरेदी कशी व्यवस्थापित करायची?',
      ta: 'சப்ளையர்களிடமிருந்து கொள்முதல் எப்படி நிர்வகிப்பது?',
      te: 'సప్లయర్ల నుండి కొనుగోళ్లను ఎలా నిర్వహించాలి?',
      gu: 'સપ્લાયર્સ પાસેથી ખરીદી કેવી રીતે મેનેજ કરવી?',
    },
    answer: {
      en: '1. First add suppliers in the **Suppliers** page\n2. Go to **Purchases** to record purchase orders\n3. Add items, quantities, and costs\n4. Save the purchase — stock automatically updates\n\nThis helps track cost prices, supplier payments, and purchase history.',
      hi: '1. पहले **आपूर्तिकर्ता** पेज में आपूर्तिकर्ता जोड़ें\n2. **खरीद** पर जाकर खरीद ऑर्डर दर्ज करें\n3. आइटम, मात्रा और लागत जोड़ें\n4. सेव करें — स्टॉक ऑटो अपडेट होगा',
      mr: '1. प्रथम **पुरवठादार** पेजमध्ये पुरवठादार जोडा\n2. **खरेदी** वर जा',
      ta: '1. முதலில் **சப்ளையர்கள்** பக்கத்தில் சப்ளையர்களைச் சேர்க்கவும்\n2. **கொள்முதல்** பக்கத்திற்கு செல்லவும்',
      te: '1. మొదట **సప్లయర్‌లు** పేజీలో సప్లయర్‌లను జోడించండి\n2. **కొనుగోళ్లు** కి వెళ్ళండి',
      gu: '1. પહેલા **સપ્લાયર્સ** પેજમાં સપ્લાયર ઉમેરો\n2. **ખરીદી** પર જાઓ',
    },
  },
  {
    id: 43, category: 'billing',
    keywords: ['expense', 'kharcha', 'expenditure', 'cost'],
    question: {
      en: 'How do I track expenses?',
      hi: 'खर्चों को कैसे ट्रैक करें?',
      mr: 'खर्च कसे ट्रॅक करायचे?',
      ta: 'செலவுகளை எப்படி கண்காணிப்பது?',
      te: 'ఖర్చులను ఎలా ట్రాక్ చేయాలి?',
      gu: 'ખર્ચ કેવી રીતે ટ્રેક કરવો?',
    },
    answer: {
      en: 'Go to **Expenses** from the sidebar to log business expenses:\n• Rent, electricity, salaries, etc.\n• Categorize expenses\n• Track date and amounts\n• View in Profit & Loss reports\n\nThis helps you understand your true profit margins.',
      hi: 'व्यापार खर्चों को रिकॉर्ड करने के लिए **खर्चे** पेज पर जाएं।',
      mr: 'व्यवसाय खर्च नोंदवण्यासाठी **खर्च** पेजवर जा.',
      ta: 'வணிக செலவுகளைப் பதிவு செய்ய **செலவுகள்** பக்கத்திற்கு செல்லவும்.',
      te: 'వ్యాపార ఖర్చులను రికార్డ్ చేయడానికి **ఖర్చులు** పేజీకి వెళ్ళండి.',
      gu: 'બિઝનેસ ખર્ચ રેકોર્ડ કરવા **ખર્ચ** પેજ પર જાઓ.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TROUBLESHOOTING (44–55)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 44, category: 'troubleshooting',
    keywords: ['blank page', 'white screen', 'page not loading', 'crash', 'error'],
    question: {
      en: 'A page is showing blank / white screen. What do I do?',
      hi: 'पेज ब्लैंक / सफेद स्क्रीन दिखा रहा है। क्या करूं?',
      mr: 'पेज ब्लँक / पांढरा स्क्रीन दाखवत आहे. काय करू?',
      ta: 'பக்கம் வெற்று / வெள்ளை திரை காட்டுகிறது. என்ன செய்வது?',
      te: 'పేజీ బ్లాంక్ / వైట్ స్క్రీన్ చూపిస్తుంది. ఏం చేయాలి?',
      gu: 'પેજ બ્લેન્ક / સફેદ સ્ક્રીન બતાવે છે. શું કરવું?',
    },
    answer: {
      en: 'Try these steps:\n1. **Refresh** the page (Ctrl+R or F5)\n2. **Clear browser cache** (Ctrl+Shift+Delete)\n3. **Hard refresh** (Ctrl+Shift+R)\n4. Check the browser **console** (F12 → Console tab) for errors\n5. **Log out and log back in**\n6. Try a different browser (Chrome recommended)\n\nIf the issue persists, it might be a server-side error — contact your admin.',
      hi: 'ये कदम आज़माएं:\n1. पेज **रिफ्रेश** करें\n2. **ब्राउज़र कैश** क्लियर करें\n3. **हार्ड रिफ्रेश** करें\n4. **लॉग आउट** करके दोबारा लॉगिन करें',
      mr: 'हे उपाय करून पहा:\n1. पेज **रिफ्रेश** करा\n2. **ब्राउझर कॅश** क्लिअर करा',
      ta: 'இந்த படிகளை முயற்சிக்கவும்:\n1. பக்கத்தை **புதுப்பிக்கவும்**\n2. **உலாவி கேச்** அழிக்கவும்',
      te: 'ఈ దశలు ప్రయత్నించండి:\n1. పేజీని **రిఫ్రెష్** చేయండి\n2. **బ్రౌజర్ కాష్** క్లియర్ చేయండి',
      gu: 'આ પગલાં અજમાવો:\n1. પેજ **રિફ્રેશ** કરો\n2. **બ્રાઉઝર કેશ** ક્લિયર કરો',
    },
  },
  {
    id: 45, category: 'troubleshooting',
    keywords: ['bluetooth not supported', 'web bluetooth', 'browser support', 'chrome'],
    question: {
      en: 'Web Bluetooth is not supported in my browser. What do I do?',
      hi: 'मेरे ब्राउज़र में Web Bluetooth सपोर्ट नहीं है। क्या करूं?',
      mr: 'माझ्या ब्राउझरमध्ये Web Bluetooth समर्थित नाही. काय करू?',
      ta: 'என் உலாவியில் Web Bluetooth ஆதரிக்கப்படவில்லை. என்ன செய்வது?',
      te: 'నా బ్రౌజర్‌లో Web Bluetooth సపోర్ట్ లేదు. ఏం చేయాలి?',
      gu: 'મારા બ્રાઉઝરમાં Web Bluetooth સપોર્ટ નથી. શું કરવું?',
    },
    answer: {
      en: 'Web Bluetooth requires:\n• **Google Chrome** (v56+) ✅\n• **Microsoft Edge** (Chromium-based) ✅\n• **Opera** ✅\n\nNot supported in:\n• ❌ Firefox\n• ❌ Safari\n• ❌ Internet Explorer\n\nSwitch to Chrome or Edge for Bluetooth printing. For non-Bluetooth printers, use the browser\'s built-in print dialog instead.',
      hi: 'Web Bluetooth के लिए:\n• **Google Chrome** (v56+) ✅\n• **Microsoft Edge** ✅\n\nसमर्थित नहीं:\n• ❌ Firefox\n• ❌ Safari\n\nChrome या Edge पर स्विच करें।',
      mr: 'Web Bluetooth साठी Chrome किंवा Edge वापरा.',
      ta: 'Web Bluetooth க்கு Chrome அல்லது Edge பயன்படுத்தவும்.',
      te: 'Web Bluetooth కోసం Chrome లేదా Edge వాడండి.',
      gu: 'Web Bluetooth માટે Chrome અથવા Edge વાપરો.',
    },
  },
  {
    id: 46, category: 'troubleshooting',
    keywords: ['settings not saving', 'save problem', 'data lost', 'refresh', 'reset'],
    question: {
      en: 'My settings are not saving / reset after refresh. Why?',
      hi: 'मेरी सेटिंग्स सेव नहीं हो रही / रिफ्रेश के बाद रीसेट हो जाती हैं। क्यों?',
      mr: 'माझ्या सेटिंग्ज सेव्ह होत नाहीत / रिफ्रेश नंतर रीसेट होतात. का?',
      ta: 'எனது அமைப்புகள் சேமிக்கப்படவில்லை / புதுப்பித்த பின் மீட்டமைக்கப்படுகின்றன. ஏன்?',
      te: 'నా సెట్టింగ్‌లు సేవ్ అవడం లేదు / రిఫ్రెష్ తర్వాత రీసెట్ అవుతున్నాయి. ఎందుకు?',
      gu: 'મારી સેટિંગ્સ સેવ થતી નથી / રિફ્રેશ પછી રીસેટ થાય છે. કેમ?',
    },
    answer: {
      en: 'Make sure you click the **"Save Settings"** button after making changes. Settings are stored in the database, so they persist across sessions.\n\nIf settings still reset:\n1. Check your internet connection\n2. Make sure the backend server is running\n3. Look for error messages (red toasts)\n4. Try logging out and back in\n\nAll settings (printer, receipt, label, business info) save to the same database record.',
      hi: 'बदलाव करने के बाद **"सेटिंग्स सेव करें"** बटन पर क्लिक करना सुनिश्चित करें।',
      mr: 'बदल केल्यानंतर **"सेटिंग्ज सेव्ह करा"** बटणावर क्लिक करा.',
      ta: 'மாற்றங்கள் செய்த பின் **"அமைப்புகளை சேமி"** பொத்தானைக் கிளிக் செய்யவும்.',
      te: 'మార్పులు చేసిన తర్వాత **"సెట్టింగ్‌లు సేవ్ చేయి"** బటన్ క్లిక్ చేయండి.',
      gu: 'ફેરફારો કર્યા પછી **"સેટિંગ્સ સેવ કરો"** બટન ક્લિક કરો.',
    },
  },
  {
    id: 47, category: 'troubleshooting',
    keywords: ['label misprint', 'label overlapping', '2 stickers', 'sticker misalign'],
    question: {
      en: 'Labels are printing across 2 stickers / misaligned. How to fix?',
      hi: 'लेबल 2 स्टिकर पर प्रिंट हो रहे हैं / गलत एलाइन हैं। कैसे ठीक करें?',
      mr: 'लेबल 2 स्टिकर्सवर प्रिंट होत आहेत / चुकीच्या ठिकाणी आहेत. कसे दुरुस्त करायचे?',
      ta: 'லேபிள்கள் 2 ஸ்டிக்கர்களில் அச்சிடப்படுகின்றன / தவறாக சீரமைக்கப்பட்டுள்ளன. எப்படி சரிசெய்வது?',
      te: 'లేబుల్‌లు 2 స్టిక్కర్‌లపై ప్రింట్ అవుతున్నాయి / తప్పుగా అమర్చబడ్డాయి. ఎలా ఫిక్స్ చేయాలి?',
      gu: 'લેબલ 2 સ્ટીકર પર પ્રિંટ થાય છે / ખોટી રીતે ગોઠવાયેલ છે. કેવી રીતે ઠીક કરવું?',
    },
    answer: {
      en: 'This happens when the printer\'s gap sensor needs calibration:\n\n1. Go to **Printers** → **Label** tab\n2. Make sure **TSPL Mode** is selected (not ESC/POS)\n3. Click **"Calibrate Paper Gap"** button\n4. Verify the label size matches your sticker roll (e.g., 50×30 mm)\n5. Try a test print\n\n💡 If using ESC/POS mode, switch to TSPL mode for gap-sensing sticker printers.',
      hi: 'यह तब होता है जब प्रिंटर के गैप सेंसर को कैलिब्रेशन की जरूरत होती है:\n1. **प्रिंटर्स** → **लेबल** टैब पर जाएं\n2. **TSPL मोड** चुनें\n3. **"पेपर गैप कैलिब्रेट करें"** क्लिक करें\n4. लेबल साइज़ सत्यापित करें',
      mr: 'प्रिंटरच्या गॅप सेन्सरला कॅलिब्रेशनची आवश्यकता आहे:\n1. **प्रिंटर्स** → **लेबल** टॅबवर जा\n2. **TSPL मोड** निवडा\n3. **"पेपर गॅप कॅलिब्रेट करा"** वर क्लिक करा',
      ta: 'பிரிண்டரின் இடைவெளி உணர்விக்கு அளவீடு தேவை.',
      te: 'ప్రింటర్ గ్యాప్ సెన్సర్‌కు కాలిబ్రేషన్ అవసరం.',
      gu: 'પ્રિન્ટરના ગેપ સેન્સરને કેલિબ્રેશનની જરૂર છે.',
    },
  },
  {
    id: 48, category: 'troubleshooting',
    keywords: ['login error', 'cannot login', 'wrong password', 'invalid credentials'],
    question: {
      en: 'I can\'t log in — it says "Invalid credentials"',
      hi: 'लॉगिन नहीं हो रहा — "अमान्य क्रेडेंशियल" कह रहा है',
      mr: 'लॉगिन होत नाही — "अवैध क्रेडेन्शियल्स" सांगत आहे',
      ta: 'உள்நுழைய முடியவில்லை — "தவறான சான்றுகள்" என்று கூறுகிறது',
      te: 'లాగిన్ చేయలేకపోతున్నాను — "చెల్లని ఆధారాలు" అని చెబుతుంది',
      gu: 'લૉગિન થતું નથી — "અમાન્ય ક્રેડેન્શિયલ્સ" કહે છે',
    },
    answer: {
      en: 'Double-check:\n1. **Email** — Make sure it\'s the exact email you registered with (case-sensitive)\n2. **Password** — Check for typos, caps lock, extra spaces\n3. **Role** — Admins and Agents have separate accounts. Make sure you\'re using the right email for the right role\n\nIf still stuck, use **"Forgot Password?"** to reset via OTP email.',
      hi: 'जांचें:\n1. **ईमेल** — सही ईमेल दर्ज है या नहीं\n2. **पासवर्ड** — टाइपो, कैप्स लॉक चेक करें\n3. **रोल** — सही रोल का ईमेल उपयोग करें\n\nअगर फिर भी नहीं हो रहा, **"पासवर्ड भूल गए?"** से रीसेट करें।',
      mr: 'तपासा:\n1. बरोबर ईमेल\n2. पासवर्ड टायपो तपासा\n3. योग्य रोल वापरा',
      ta: 'சரிபார்க்கவும்:\n1. சரியான மின்னஞ்சல்\n2. கடவுச்சொல் பிழைகளை சரிபார்க்கவும்',
      te: 'చెక్ చేయండి:\n1. సరైన ఇమెయిల్\n2. పాస్‌వర్డ్ టైపోలు చెక్ చేయండి',
      gu: 'તપાસો:\n1. સાચો ઈમેલ\n2. પાસવર્ડ ટાઈપો તપાસો',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MORE GENERAL FAQ (49–55)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 49, category: 'getting_started',
    keywords: ['mobile', 'phone', 'tablet', 'responsive', 'android', 'iphone'],
    question: {
      en: 'Does Seznik POS work on mobile / tablet?',
      hi: 'क्या Seznik POS मोबाइल / टैबलेट पर काम करता है?',
      mr: 'Seznik POS मोबाइल / टॅबलेटवर काम करतो का?',
      ta: 'Seznik POS மொபைல் / டேப்லெட்டில் வேலை செய்யுமா?',
      te: 'Seznik POS మొబైల్ / ట్యాబ్లెట్‌లో పని చేస్తుందా?',
      gu: 'Seznik POS મોબાઈલ / ટેબલેટ પર કામ કરે છે?',
    },
    answer: {
      en: 'Yes! Seznik POS is fully responsive and works on:\n• 📱 Mobile phones (Android & iPhone)\n• 📱 Tablets (iPad, Android tablets)\n• 💻 Laptops & Desktops\n\nThe interface adapts automatically. A mobile navigation bar appears at the bottom on smaller screens.\n\n⚠️ Note: Bluetooth printing requires Chrome or Edge on Android. iOS Safari doesn\'t support Web Bluetooth.',
      hi: 'हां! Seznik POS पूरी तरह से रेस्पॉन्सिव है और काम करता है:\n• 📱 मोबाइल फोन\n• 📱 टैबलेट\n• 💻 लैपटॉप और डेस्कटॉप\n\n⚠️ ध्यान दें: ब्लूटूथ प्रिंटिंग के लिए Android पर Chrome या Edge चाहिए।',
      mr: 'होय! Seznik POS पूर्णपणे रेस्पॉन्सिव्ह आहे.',
      ta: 'ஆம்! Seznik POS முழுமையாக பதிலளிக்கக்கூடியது.',
      te: 'అవును! Seznik POS పూర్తిగా రెస్పాన్సివ్.',
      gu: 'હા! Seznik POS સંપૂર્ણ રિસ્પોન્સિવ છે.',
    },
  },
  {
    id: 50, category: 'getting_started',
    keywords: ['offline', 'no internet', 'internet required'],
    question: {
      en: 'Does Seznik POS work offline?',
      hi: 'क्या Seznik POS ऑफलाइन काम करता है?',
      mr: 'Seznik POS ऑफलाइन काम करतो का?',
      ta: 'Seznik POS ஆஃப்லைனில் வேலை செய்யுமா?',
      te: 'Seznik POS ఆఫ్‌లైన్‌లో పని చేస్తుందా?',
      gu: 'Seznik POS ઓફલાઈન કામ કરે છે?',
    },
    answer: {
      en: 'Currently, Seznik POS requires an internet connection to:\n• Authenticate users\n• Save/load data from the database\n• Sync settings across devices\n\nHowever, Bluetooth printing works directly between your browser and printer — no internet needed for that part!\n\nOffline mode with local sync is planned for a future update.',
      hi: 'वर्तमान में, Seznik POS को इंटरनेट कनेक्शन की आवश्यकता है। ब्लूटूथ प्रिंटिंग बिना इंटरनेट काम करती है। ऑफलाइन मोड भविष्य में आएगा।',
      mr: 'सध्या Seznik POS ला इंटरनेट आवश्यक आहे. ब्लूटूथ प्रिंटिंग इंटरनेटशिवाय काम करते.',
      ta: 'தற்போது Seznik POS க்கு இணைய இணைப்பு தேவை.',
      te: 'ప్రస్తుతం Seznik POS కి ఇంటర్నెట్ కనెక్షన్ అవసరం.',
      gu: 'હાલમાં Seznik POS ને ઈન્ટરનેટ કનેક્શનની જરૂર છે.',
    },
  },
]
