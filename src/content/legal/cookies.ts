import type { LegalSource } from "./types";

/**
 * Cookie policy. These are all the cookies the site sets itself (see src/i18n/routing.ts,
 * src/proxy.ts and the Better Auth config in src/lib/auth.ts); update this when one is added.
 */
export const cookies: LegalSource = {
  updated: "2026-10-14",
  en: () => ({
    title: "Cookie policy",
    summary:
      "Bizim Event only uses cookies that the site needs to work or that remember your choices. There are no advertising or tracking cookies.",
    sections: [
      {
        id: "what",
        heading: "What cookies are",
        blocks: [
          "Cookies are small files that a website stores in your browser. We use them to keep you logged in and to remember your language and country.",
        ],
      },
      {
        id: "ours",
        heading: "The cookies we use",
        blocks: [
          {
            list: [
              "BE_LOCALE — remembers your language (Turkish or English). Kept for 1 year.",
              "BE_COUNTRY — remembers your country, so cities and prices suit where you are. It's set from your connection on your first visit and changes when you pick another country. Kept for 1 year.",
              "be.session_token — keeps you logged in. Kept for 30 days, or until you log out.",
              "be.session_data — a short-lived copy of your login that makes pages load faster. Kept for 5 minutes.",
              "Other be.… cookies — short-lived cookies that keep signing in with Google or an email link secure. Kept for up to 10 minutes.",
            ],
          },
        ],
      },
      {
        id: "others",
        heading: "Other websites",
        blocks: [
          "When a business pays for its subscription, it does so on Stripe's pages, which use Stripe's own cookies. Signing in with Google happens on Google's pages in the same way. Their own cookie policies apply there.",
        ],
      },
      {
        id: "consent",
        heading: "Why there's no cookie banner",
        blocks: [
          "Every cookie above is needed for the site to work or remembers a choice you made, so the law doesn't require us to ask for consent. If we ever add analytics or advertising cookies, we'll ask you first.",
        ],
      },
      {
        id: "control",
        heading: "Controlling cookies",
        blocks: [
          "You can delete or block cookies in your browser's settings. If you block them you won't be able to log in, and the site will forget your language and country.",
        ],
      },
    ],
  }),
  tr: () => ({
    title: "Çerez politikası",
    summary:
      "Bizim Event yalnızca sitenin çalışması için gereken ya da seçimlerinizi hatırlayan çerezleri kullanır. Reklam ya da izleme çerezi yoktur.",
    sections: [
      {
        id: "what",
        heading: "Çerez nedir?",
        blocks: [
          "Çerezler, bir web sitesinin tarayıcınızda sakladığı küçük dosyalardır. Biz bunları oturumunuzu açık tutmak ve dilinizi ve ülkenizi hatırlamak için kullanıyoruz.",
        ],
      },
      {
        id: "ours",
        heading: "Kullandığımız çerezler",
        blocks: [
          {
            list: [
              "BE_LOCALE — dilinizi (Türkçe ya da İngilizce) hatırlar. 1 yıl saklanır.",
              "BE_COUNTRY — ülkenizi hatırlar; böylece şehirler ve fiyatlar bulunduğunuz yere uygun olur. İlk ziyaretinizde bağlantınıza göre belirlenir, başka bir ülke seçtiğinizde değişir. 1 yıl saklanır.",
              "be.session_token — oturumunuzu açık tutar. 30 gün ya da çıkış yapana kadar saklanır.",
              "be.session_data — sayfaların daha hızlı açılmasını sağlayan, oturumunuzun kısa ömürlü bir kopyası. 5 dakika saklanır.",
              "Diğer be.… çerezleri — Google ile ya da e-posta bağlantısıyla girişi güvenli tutan kısa ömürlü çerezler. En fazla 10 dakika saklanır.",
            ],
          },
        ],
      },
      {
        id: "others",
        heading: "Diğer siteler",
        blocks: [
          "Bir işletme aboneliğinin ödemesini Stripe'ın sayfalarında yapar; bu sayfalar Stripe'ın kendi çerezlerini kullanır. Google ile giriş de aynı şekilde Google'ın sayfalarında gerçekleşir. Oralarda onların çerez politikaları geçerlidir.",
        ],
      },
      {
        id: "consent",
        heading: "Neden çerez uyarısı yok?",
        blocks: [
          "Yukarıdaki çerezlerin her biri sitenin çalışması için gereklidir ya da yaptığınız bir seçimi hatırlar; bu yüzden yasa bizden onay istememizi gerektirmez. İleride analiz ya da reklam çerezleri eklersek önce sizden izin isteriz.",
        ],
      },
      {
        id: "control",
        heading: "Çerezleri kontrol etmek",
        blocks: [
          "Tarayıcınızın ayarlarından çerezleri silebilir ya da engelleyebilirsiniz. Engellerseniz giriş yapamazsınız ve site dilinizi ve ülkenizi unutur.",
        ],
      },
    ],
  }),
};
