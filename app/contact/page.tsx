import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

export default function ContactPage() {
  return <main className="contactPage" dir="rtl">
    <header><a href="/"><img src="/brand/logo.png" alt="Purity Ritual"/></a><a href="/">العودة للرئيسية</a></header>
    <section className="contactHero">
      <div><span>تواصل معنا</span><h1>كيف يمكننا خدمتك؟</h1><p>فريق Purity Ritual جاهز لاستقبال طلبات النظافة والاستفسارات ومواعيد المعاينة في جدة.</p></div>
      <img src="/brand/team-professional.png" alt="فريق Purity Ritual"/>
    </section>
    <section className="contactCards">
      <a href="https://wa.me/966555330406" target="_blank" rel="noreferrer"><MessageCircle/><div><strong>واتساب</strong><span>+966 55 533 0406</span></div></a>
      <a href="tel:+966555330406"><Phone/><div><strong>اتصال مباشر</strong><span>+966 55 533 0406</span></div></a>
      <a href="mailto:ahmedazi911@gmail.com"><Mail/><div><strong>البريد الإلكتروني</strong><span>ahmedazi911@gmail.com</span></div></a>
      <article><MapPin/><div><strong>نطاق الخدمة</strong><span>جدة، المملكة العربية السعودية</span></div></article>
    </section>
    <section className="contactCta"><h2>تحتاج عرض سعر؟</h2><p>يمكنك إرسال طلب مجاني من الصفحة الرئيسية دون إنشاء حساب.</p><a href="/#services">عرض الخدمات وطلب السعر</a></section>
  </main>;
}
