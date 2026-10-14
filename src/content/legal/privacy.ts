import { operatorBlock, type LegalSource } from "./types";

/** Privacy policy (UK GDPR). Keep the provider list in step with src/lib/adapters. */
export const privacy: LegalSource = {
  updated: "2026-10-14",
  en: (v) => ({
    title: "Privacy policy",
    summary:
      "What personal data Bizim Event collects, why, who we share it with, and your rights. We don't sell your data and we don't use advertising trackers.",
    sections: [
      {
        id: "who",
        heading: "Who we are",
        blocks: [
          "Bizim Event is responsible for the personal data described here (we are its “controller”). You can reach us about privacy through our [contact page](/contact).",
          ...operatorBlock(v),
        ],
      },
      {
        id: "collect",
        heading: "What we collect",
        blocks: [
          {
            list: [
              "Account details: your name, email address and password (stored only in a scrambled form that can't be read back), your language and country, and whether you use Bizim Event as a customer or a business. If you sign in with Google, Google gives us your name, email address and profile photo.",
              "Business details: what businesses add to their page — business name, contact phone and email, address, descriptions, photos, prices and policies.",
              "Billing details: for businesses that subscribe, Stripe collects the card details; we never see or store card numbers. We keep the plan, its status and Stripe's reference numbers.",
              "Messages and emails: the emails we send you, such as account and billing emails, and — once enquiries open — what customers and businesses send each other through the site.",
              "Technical details: your IP address, browser type and the pages you visit, kept in our server logs for security and to fix problems, and the cookies described in our [cookie policy](/legal/cookies).",
            ],
          },
        ],
      },
      {
        id: "use",
        heading: "How we use it, and why",
        blocks: [
          {
            list: [
              "To run your account and the service you asked for, including business pages, billing and the emails that go with them — because it's needed for our contract with you.",
              "To check businesses before they are published, keep accounts secure, prevent spam and abuse, and fix problems — because we have a legitimate interest in a safe, reliable service.",
              "To send news and offers by email, only if you've agreed to it. You can withdraw your consent at any time.",
              "To keep financial records and meet our other legal obligations — because the law requires it.",
            ],
          },
        ],
      },
      {
        id: "public",
        heading: "What other people can see",
        blocks: [
          "Once approved, a business page is public: its name, area or address, descriptions, photos, prices and policies. A customer's details are shared with a business only when that customer contacts it.",
        ],
      },
      {
        id: "share",
        heading: "Who we share it with",
        blocks: [
          "We don't sell personal data. We use these service providers to run Bizim Event, and they may only use the data to provide their service to us:",
          {
            list: [
              "Vercel — hosting the website",
              "Neon — our database",
              "Cloudflare — storing photos and protecting forms from spam",
              "Resend — sending emails",
              "Stripe — subscription payments",
              "Upstash — limiting repeated attempts, such as password guessing",
              "Google — signing in with Google, and address search",
              "Komoot Photon, using OpenStreetMap data — address search",
              "Pusher — live messages, once chat opens",
              "Anthropic — translating a listing's text, when its business asks us to",
              "Sentry — reports of errors in the site",
            ],
          },
          "We may also share data when the law requires it, or to protect people from harm or fraud.",
        ],
      },
      {
        id: "transfers",
        heading: "Data outside the UK",
        blocks: [
          "Some of these providers store or process data outside the UK, including in the United States. When they do, we rely on the protections UK law requires, such as the UK's adequacy regulations (including the UK–US data bridge) or the UK's standard contract clauses.",
        ],
      },
      {
        id: "keep",
        heading: "How long we keep it",
        blocks: [
          {
            list: [
              "Account details: for as long as your account is open. If you ask us to delete your account, we do so within 30 days, except for what we must keep by law.",
              "Business pages: while the business uses Bizim Event. Hidden pages are kept so the business can come back, until it asks us to delete them.",
              "Billing records: six years, as UK tax law requires.",
              "Server logs: up to 30 days.",
            ],
          },
        ],
      },
      {
        id: "rights",
        heading: "Your rights",
        blocks: [
          "You can ask us for a copy of your data, to correct or delete it, to restrict or object to how we use it, or to receive it in a portable format. Where we rely on your consent, you can withdraw it at any time. [Contact us](/contact) to use any of these rights; we'll reply within a month.",
          "If you're unhappy with how we handle your data, you can complain to the Information Commissioner's Office at ico.org.uk. We'd appreciate the chance to put it right first.",
        ],
      },
      {
        id: "children",
        heading: "Children",
        blocks: ["Bizim Event is not for children: you must be 18 or over to create an account."],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        blocks: [
          "We'll update this policy when the way we use data changes, and show the date of the latest version at the top. We'll email account holders about important changes.",
        ],
      },
    ],
  }),
  tr: (v) => ({
    title: "Gizlilik politikası",
    summary:
      "Bizim Event'in hangi kişisel verileri topladığı, neden topladığı, kimlerle paylaştığı ve haklarınız. Verilerinizi satmıyoruz ve reklam amaçlı izleme araçları kullanmıyoruz.",
    sections: [
      {
        id: "who",
        heading: "Biz kimiz?",
        blocks: [
          "Burada anlatılan kişisel verilerden Bizim Event sorumludur (“veri sorumlusu”). Gizlilikle ilgili konularda [iletişim sayfamızdan](/contact) bize ulaşabilirsiniz.",
          ...operatorBlock(v),
        ],
      },
      {
        id: "collect",
        heading: "Hangi verileri topluyoruz?",
        blocks: [
          {
            list: [
              "Hesap bilgileri: adınız, e-posta adresiniz ve şifreniz (geri okunamayacak biçimde şifrelenmiş olarak saklanır), diliniz ve ülkeniz ile Bizim Event'i müşteri olarak mı yoksa işletme olarak mı kullandığınız. Google ile giriş yaparsanız Google bize adınızı, e-posta adresinizi ve profil fotoğrafınızı iletir.",
              "İşletme bilgileri: işletmelerin sayfalarına eklediği bilgiler — işletme adı, iletişim telefonu ve e-postası, adres, açıklamalar, fotoğraflar, fiyatlar ve koşullar.",
              "Ödeme bilgileri: abone olan işletmelerin kart bilgilerini Stripe toplar; kart numaralarını hiçbir zaman görmez ve saklamayız. Planı, durumunu ve Stripe'ın referans numaralarını saklarız.",
              "Mesajlar ve e-postalar: size gönderdiğimiz hesap ve faturalandırma e-postaları gibi e-postalar ve — talepler açıldığında — müşterilerle işletmelerin site üzerinden birbirine gönderdikleri.",
              "Teknik bilgiler: güvenlik ve sorunları gidermek için sunucu kayıtlarımızda tutulan IP adresiniz, tarayıcı türünüz ve ziyaret ettiğiniz sayfalar ile [çerez politikamızda](/legal/cookies) anlatılan çerezler.",
            ],
          },
        ],
      },
      {
        id: "use",
        heading: "Verileri nasıl ve neden kullanıyoruz?",
        blocks: [
          {
            list: [
              "Hesabınızı ve istediğiniz hizmeti — işletme sayfaları, faturalandırma ve bunlarla ilgili e-postalar dahil — sunmak için; çünkü sizinle yaptığımız sözleşme için gereklidir.",
              "İşletmeleri yayınlamadan önce kontrol etmek, hesapları güvende tutmak, spam ve kötüye kullanımı önlemek ve sorunları gidermek için; çünkü güvenli ve güvenilir bir hizmet sunmakta meşru menfaatimiz vardır.",
              "Haber ve kampanyaları e-postayla göndermek için, yalnızca buna onay verdiyseniz. Onayınızı istediğiniz zaman geri çekebilirsiniz.",
              "Mali kayıtları tutmak ve diğer yasal yükümlülüklerimizi yerine getirmek için; çünkü yasa bunu gerektirir.",
            ],
          },
        ],
      },
      {
        id: "public",
        heading: "Başkalarının görebildikleri",
        blocks: [
          "Onaylanan bir işletme sayfası herkese açıktır: adı, bölgesi ya da adresi, açıklamaları, fotoğrafları, fiyatları ve koşulları. Bir müşterinin bilgileri, yalnızca o müşteri bir işletmeyle iletişime geçtiğinde o işletmeyle paylaşılır.",
        ],
      },
      {
        id: "share",
        heading: "Verileri kimlerle paylaşıyoruz?",
        blocks: [
          "Kişisel verileri satmıyoruz. Bizim Event'i çalıştırmak için aşağıdaki hizmet sağlayıcılarını kullanıyoruz; bu sağlayıcılar verileri yalnızca bize hizmet vermek için kullanabilir:",
          {
            list: [
              "Vercel — web sitesinin barındırılması",
              "Neon — veritabanımız",
              "Cloudflare — fotoğrafların saklanması ve formların spamdan korunması",
              "Resend — e-posta gönderimi",
              "Stripe — abonelik ödemeleri",
              "Upstash — şifre tahmini gibi tekrarlanan denemelerin sınırlanması",
              "Google — Google ile giriş ve adres arama",
              "Komoot Photon, OpenStreetMap verileriyle — adres arama",
              "Pusher — canlı mesajlar, sohbet açıldığında",
              "Anthropic — işletmesi istediğinde bir ilanın metninin çevrilmesi",
              "Sentry — sitedeki hataların raporlanması",
            ],
          },
          "Yasa gerektirdiğinde ya da insanları zarardan veya dolandırıcılıktan korumak için de veri paylaşabiliriz.",
        ],
      },
      {
        id: "transfers",
        heading: "Birleşik Krallık dışındaki veriler",
        blocks: [
          "Bu sağlayıcıların bazıları verileri Birleşik Krallık dışında, Amerika Birleşik Devletleri dahil, saklar veya işler. Bu durumda Birleşik Krallık yasalarının gerektirdiği korumalara dayanırız: Birleşik Krallık'ın yeterlilik düzenlemeleri (Birleşik Krallık–ABD veri köprüsü dahil) ya da standart sözleşme hükümleri gibi.",
        ],
      },
      {
        id: "keep",
        heading: "Verileri ne kadar süre saklıyoruz?",
        blocks: [
          {
            list: [
              "Hesap bilgileri: hesabınız açık olduğu sürece. Hesabınızın silinmesini isterseniz, yasa gereği saklamamız gerekenler dışında 30 gün içinde sileriz.",
              "İşletme sayfaları: işletme Bizim Event'i kullandığı sürece. Gizlenen sayfalar, işletme geri dönebilsin diye, işletme silinmesini isteyene kadar saklanır.",
              "Fatura kayıtları: Birleşik Krallık vergi mevzuatının gerektirdiği gibi altı yıl.",
              "Sunucu kayıtları: en fazla 30 gün.",
            ],
          },
        ],
      },
      {
        id: "rights",
        heading: "Haklarınız",
        blocks: [
          "Verilerinizin bir kopyasını, düzeltilmesini veya silinmesini isteyebilir, kullanımını kısıtlayabilir ya da itiraz edebilir ve verilerinizi taşınabilir bir biçimde alabilirsiniz. Onayınıza dayandığımız durumlarda onayınızı istediğiniz zaman geri çekebilirsiniz. Bu haklarınızı kullanmak için [bize ulaşın](/contact); bir ay içinde yanıt veririz.",
          "Verilerinizi nasıl işlediğimizden memnun değilseniz Birleşik Krallık Bilgi Komiserliği'ne (ICO, ico.org.uk) şikâyette bulunabilirsiniz. Öncelikle sorunu düzeltmemiz için bize fırsat vermenizi rica ederiz.",
        ],
      },
      {
        id: "children",
        heading: "Çocuklar",
        blocks: ["Bizim Event çocuklara yönelik değildir: hesap açmak için 18 yaşında veya daha büyük olmalısınız."],
      },
      {
        id: "changes",
        heading: "Bu politikadaki değişiklikler",
        blocks: [
          "Verileri kullanma şeklimiz değiştiğinde bu politikayı günceller ve en son sürümün tarihini en üstte gösteririz. Önemli değişiklikleri hesap sahiplerine e-postayla bildiririz.",
        ],
      },
    ],
  }),
};
