import { operatorBlock, type LegalSource } from "./types";

/** Terms of use: everyone who uses the site. Businesses also accept the business terms. */
export const terms: LegalSource = {
  updated: "2026-10-14",
  en: (v) => ({
    title: "Terms of use",
    summary:
      "The rules for using Bizim Event. In short: we help you find and contact businesses, any booking is between you and the business, and please use the site honestly.",
    sections: [
      {
        id: "about",
        heading: "About these terms",
        blocks: [
          "These terms apply to everyone who uses Bizim Event, the website where you can find venues, caterers and performers for your events. By using the site you agree to them. Businesses that list on Bizim Event also agree to our [business terms](/legal/business-terms).",
          ...operatorBlock(v),
        ],
      },
      {
        id: "what-we-do",
        heading: "What Bizim Event does",
        blocks: [
          "Bizim Event is a directory where businesses describe what they offer, and where you can search, compare and contact them. We are not a party to any agreement you make with a business, and we don't provide the venues, food or performances ourselves.",
          "We check every business and listing before it is published, but we can't verify everything a business tells us. Before you book, confirm the details that matter to you — capacity, prices, what's included, licences and insurance — directly with the business.",
        ],
      },
      {
        id: "account",
        heading: "Your account",
        blocks: [
          {
            list: [
              "You must be 18 or over to create an account.",
              "Give accurate details and keep them up to date.",
              "Keep your password safe. You're responsible for what happens in your account.",
              "Tell us straight away if you think someone else has used it.",
            ],
          },
        ],
      },
      {
        id: "bookings",
        heading: "Bookings and payments",
        blocks: [
          "Bookings, deposits and balances are agreed and paid directly between you and the business. Bizim Event does not handle booking payments and does not charge customers anything.",
          "Each listing shows the business's own cancellation policy. Read it before you pay a deposit: refunds are a matter between you and the business.",
        ],
      },
      {
        id: "fair-use",
        heading: "Using the site fairly",
        blocks: [
          "Please don't:",
          {
            list: [
              "give false information or pretend to be someone else;",
              "post anything unlawful, hateful or abusive, or anything you don't have the right to share;",
              "send spam, or use contact details from the site for anything other than your event;",
              "copy the site's content in bulk, scrape it, or try to break or overload it.",
            ],
          },
        ],
      },
      {
        id: "reviews",
        heading: "Reviews",
        blocks: [
          "Reviews must be honest and based on your own experience with the business. We may remove reviews and other content that break these terms.",
        ],
      },
      {
        id: "content",
        heading: "Our content",
        blocks: [
          "The design, text and software of Bizim Event belong to us or the people who license them to us. Listings, photos and descriptions belong to the businesses that provided them. City photos come from Unsplash, and their photographers are credited where they appear.",
        ],
      },
      {
        id: "liability",
        heading: "Our responsibility to you",
        blocks: [
          "We work hard to keep Bizim Event available and accurate, but we provide it as it is and can't promise it will always be uninterrupted or free of errors.",
          "We are not responsible for the services businesses provide, or for what goes wrong between you and a business. If you have a problem with a booking, raise it with the business first. You can also tell us if you think a listing is misleading.",
          "Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law doesn't allow us to limit, and nothing affects your legal rights as a consumer.",
        ],
      },
      {
        id: "suspension",
        heading: "Suspending accounts",
        blocks: [
          "We may suspend or close an account, or remove content, that breaks these terms or the law. If we do, we'll tell you why unless the law stops us.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        blocks: [
          "We may update these terms when the service changes or the law requires it. The date of the latest version is shown at the top, and we'll email account holders about important changes.",
        ],
      },
      {
        id: "law",
        heading: "Law and disputes",
        blocks: [
          `These terms are governed by the law of ${v.jurisdiction}. If you're a consumer living in the UK, you can bring proceedings in the courts of the part of the UK where you live; otherwise disputes are decided by the courts of ${v.jurisdiction}. If you live in another country, you keep the protection of the mandatory consumer laws where you live.`,
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        blocks: ["Questions about these terms? [Contact us](/contact)."],
      },
    ],
  }),
  tr: (v) => ({
    title: "Kullanım koşulları",
    summary:
      "Bizim Event'i kullanma kuralları. Kısaca: işletmeleri bulmanıza ve onlarla iletişime geçmenize yardım ediyoruz, rezervasyonlar sizinle işletme arasındadır ve lütfen siteyi dürüstçe kullanın.",
    sections: [
      {
        id: "about",
        heading: "Bu koşullar hakkında",
        blocks: [
          "Bu koşullar, etkinlikleriniz için mekan, ikram hizmeti ve sanatçı bulabileceğiniz Bizim Event web sitesini kullanan herkes için geçerlidir. Siteyi kullanarak bu koşulları kabul etmiş olursunuz. Bizim Event'te ilan veren işletmeler ayrıca [işletme koşullarımızı](/legal/business-terms) kabul eder.",
          ...operatorBlock(v),
        ],
      },
      {
        id: "what-we-do",
        heading: "Bizim Event ne yapar?",
        blocks: [
          "Bizim Event, işletmelerin sundukları hizmetleri tanıttığı, sizin de arayıp karşılaştırabileceğiniz ve iletişime geçebileceğiniz bir rehberdir. Bir işletmeyle yaptığınız anlaşmanın tarafı değiliz; mekanı, yemeği ya da gösteriyi biz sağlamıyoruz.",
          "Her işletmeyi ve ilanı yayınlamadan önce kontrol ediyoruz, ancak bir işletmenin bize söylediği her şeyi doğrulayamayız. Rezervasyon yapmadan önce sizin için önemli olan ayrıntıları — kapasite, fiyatlar, nelerin dahil olduğu, izinler ve sigorta — doğrudan işletmeyle teyit edin.",
        ],
      },
      {
        id: "account",
        heading: "Hesabınız",
        blocks: [
          {
            list: [
              "Hesap açmak için 18 yaşında veya daha büyük olmalısınız.",
              "Bilgilerinizi doğru verin ve güncel tutun.",
              "Şifrenizi güvende tutun. Hesabınızda olanlardan siz sorumlusunuz.",
              "Hesabınızı başka birinin kullandığını düşünüyorsanız hemen bize bildirin.",
            ],
          },
        ],
      },
      {
        id: "bookings",
        heading: "Rezervasyonlar ve ödemeler",
        blocks: [
          "Rezervasyonlar, kaporalar ve kalan ödemeler doğrudan sizinle işletme arasında kararlaştırılır ve ödenir. Bizim Event rezervasyon ödemelerine aracılık etmez ve müşterilerden hiçbir ücret almaz.",
          "Her ilanda işletmenin kendi iptal koşulları yer alır. Kapora ödemeden önce okuyun: iadeler sizinle işletme arasındaki bir konudur.",
        ],
      },
      {
        id: "fair-use",
        heading: "Siteyi adil kullanmak",
        blocks: [
          "Lütfen şunları yapmayın:",
          {
            list: [
              "yanlış bilgi vermek ya da başka biri gibi davranmak;",
              "yasa dışı, nefret içeren ya da taciz edici bir şey veya paylaşma hakkınız olmayan bir içerik yayınlamak;",
              "spam göndermek ya da sitedeki iletişim bilgilerini etkinliğiniz dışında bir amaçla kullanmak;",
              "sitenin içeriğini toplu halde kopyalamak, otomatik araçlarla toplamak ya da siteyi bozmaya veya aşırı yüklemeye çalışmak.",
            ],
          },
        ],
      },
      {
        id: "reviews",
        heading: "Değerlendirmeler",
        blocks: [
          "Değerlendirmeler dürüst olmalı ve işletmeyle yaşadığınız kendi deneyiminize dayanmalıdır. Bu koşullara uymayan değerlendirmeleri ve diğer içerikleri kaldırabiliriz.",
        ],
      },
      {
        id: "content",
        heading: "İçeriğimiz",
        blocks: [
          "Bizim Event'in tasarımı, metinleri ve yazılımı bize ya da bize lisans verenlere aittir. İlanlar, fotoğraflar ve açıklamalar onları sağlayan işletmelere aittir. Şehir fotoğrafları Unsplash'tan alınmıştır ve fotoğrafçıları, fotoğrafların kullanıldığı yerde belirtilir.",
        ],
      },
      {
        id: "liability",
        heading: "Size karşı sorumluluğumuz",
        blocks: [
          "Bizim Event'i erişilebilir ve doğru tutmak için çok çalışıyoruz, ancak siteyi olduğu gibi sunuyoruz ve her zaman kesintisiz ya da hatasız olacağını garanti edemeyiz.",
          "İşletmelerin sunduğu hizmetlerden ya da sizinle bir işletme arasında yaşanan sorunlardan sorumlu değiliz. Bir rezervasyonla ilgili sorun yaşarsanız önce işletmeyle konuşun. Yanıltıcı olduğunu düşündüğünüz bir ilanı bize de bildirebilirsiniz.",
          "Bu koşullardaki hiçbir şey, ihmalden kaynaklanan ölüm veya yaralanma, dolandırıcılık ya da yasanın sınırlamamıza izin vermediği başka bir durum için sorumluluğumuzu sınırlamaz ve tüketici olarak yasal haklarınızı etkilemez.",
        ],
      },
      {
        id: "suspension",
        heading: "Hesapların askıya alınması",
        blocks: [
          "Bu koşullara ya da yasaya aykırı bir hesabı askıya alabilir veya kapatabilir, içeriği kaldırabiliriz. Bunu yaparsak, yasa engellemediği sürece nedenini size bildiririz.",
        ],
      },
      {
        id: "changes",
        heading: "Koşullardaki değişiklikler",
        blocks: [
          "Hizmet değiştiğinde ya da yasa gerektirdiğinde bu koşulları güncelleyebiliriz. En son sürümün tarihi en üstte yer alır; önemli değişiklikleri hesap sahiplerine e-postayla bildiririz.",
        ],
      },
      {
        id: "law",
        heading: "Hukuk ve uyuşmazlıklar",
        blocks: [
          `Bu koşullar ${v.jurisdiction} hukukuna tabidir. Birleşik Krallık'ta yaşayan bir tüketiciyseniz yaşadığınız bölgenin mahkemelerinde dava açabilirsiniz; aksi halde uyuşmazlıklar ${v.jurisdiction} mahkemelerinde çözülür. Başka bir ülkede yaşıyorsanız, o ülkenin zorunlu tüketici koruma kurallarından yararlanmaya devam edersiniz.`,
        ],
      },
      {
        id: "contact",
        heading: "İletişim",
        blocks: ["Bu koşullarla ilgili sorularınız mı var? [Bize ulaşın](/contact)."],
      },
    ],
  }),
};
