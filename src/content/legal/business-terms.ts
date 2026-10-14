import { formatPlanAmount, GRACE_DAYS, TRIAL_DAYS } from "@/lib/plans";
import { operatorBlock, type LegalSource } from "./types";

/** Business terms: what a business agrees to when it sends its page for review. */
export const businessTerms: LegalSource = {
  updated: "2026-10-14",
  en: (v) => {
    const monthly = formatPlanAmount("monthly", "en");
    const yearly = formatPlanAmount("yearly", "en");
    return {
      title: "Business terms",
      summary: `The agreement between Bizim Event and the businesses that list with us: a ${TRIAL_DAYS}-day free trial from approval, then ${monthly} a month or ${yearly} a year per business page, no commission, cancel any time.`,
      sections: [
        {
          id: "about",
          heading: "About these terms",
          blocks: [
            "These terms apply when you create a business page on Bizim Event. They sit alongside our [terms of use](/legal/terms) and [privacy policy](/legal/privacy). When you send your business for review, you confirm that you accept them on behalf of the business.",
            ...operatorBlock(v),
          ],
        },
        {
          id: "page",
          heading: "Your business page and listings",
          blocks: [
            "You must be authorised to list the business, and everything you publish must be accurate and kept up to date: names, addresses, capacities, prices, what's included and your cancellation policy.",
            "You are responsible for holding the licences, permissions, registrations and insurance your business needs — for example a premises licence, food hygiene registration or music licences — and for following the law where you work.",
            "Only upload photos and text that you own or have permission to use, and that show your own business.",
          ],
        },
        {
          id: "review",
          heading: "Checking and approval",
          blocks: [
            "We review every new business and listing before it is published. We may ask you for changes, or decline a business or listing that doesn't meet these terms, and we'll tell you why.",
            "Approved listings stay live while your subscription is in good standing. When you edit an approved listing, the changes appear straight away, and we may review them afterwards.",
          ],
        },
        {
          id: "trial",
          heading: "Free trial",
          blocks: [
            `Each business page gets a free trial of ${TRIAL_DAYS} days, starting on the day we approve it. You don't need a card to start, and nothing is charged during the trial.`,
            "We'll email you before the trial ends. If you haven't chosen a plan by then, your listings are hidden — not deleted — until you do.",
          ],
        },
        {
          id: "subscription",
          heading: "Subscription and payment",
          blocks: [
            {
              list: [
                `The price is ${monthly} a month or ${yearly} a year for each business page, in pounds sterling, including any tax that applies.`,
                "Payments are taken in advance by our payment provider, Stripe, and renew automatically at the end of each period until you cancel.",
                "If you choose a plan during your free trial, the first payment is taken when the trial ends.",
                "You can switch between monthly and yearly, update your card or cancel at any time from your business's Billing page.",
                `If a payment fails, your listings stay live for ${GRACE_DAYS} days while it is retried. If it still hasn't been paid after that, they are hidden until it is.`,
              ],
            },
            "We'll email you at least 30 days before changing the price. The new price applies from your next renewal, and you can cancel before then.",
          ],
        },
        {
          id: "cancelling",
          heading: "Cancelling",
          blocks: [
            "When you cancel, your listings stay live until the end of the period you've already paid for, and are then hidden. We don't refund part of a period, except where the law requires it.",
            "Hidden listings and your business details are kept so you can come back at any time. If you'd like your business page deleted completely, [contact us](/contact).",
          ],
        },
        {
          id: "no-commission",
          heading: "No commission and no booking payments",
          blocks: [
            "Bizim Event takes no commission and does not handle payments between you and your customers. You agree prices, deposits, contracts and refunds directly with your customers. You are responsible for them, and for any tax due on your income.",
          ],
        },
        {
          id: "customers",
          heading: "Customers and their details",
          blocks: [
            "Reply to enquiries honestly and promptly, and honour the prices and policies shown on your listings.",
            "When customers contact you through Bizim Event, use their details only to deal with their enquiry or booking, and follow data protection law. You are responsible for the personal data you keep about your customers.",
            "Don't ask for fake reviews, review your own business, or offer anything in return for a review.",
          ],
        },
        {
          id: "content",
          heading: "Permission to show your content",
          blocks: [
            "You keep ownership of the text and photos you upload. You allow Bizim Event to show, resize, crop and translate them on Bizim Event, and to use them to promote your listings and the site, for as long as they are on Bizim Event (and for a short time afterwards in backups).",
          ],
        },
        {
          id: "removal",
          heading: "Hiding or removing a business page",
          blocks: [
            "We may hide or remove a business page or listing that breaks these terms or the law, or that customers report and we find misleading. Where it's appropriate, we'll warn you first and give you the chance to put it right.",
          ],
        },
        {
          id: "liability",
          heading: "Liability",
          blocks: [
            "You use Bizim Event for your business. Our total liability to you in any 12 months is limited to the subscription fees you paid us in that time, and we're not liable for loss of profit, business or goodwill, or other indirect loss. Nothing here limits liability that the law doesn't allow to be limited.",
            "You are responsible for claims that arise from your services or from the content you publish.",
          ],
        },
        {
          id: "changes",
          heading: "Changes to these terms",
          blocks: [
            "We may update these terms. We'll email you about important changes at least 30 days before they take effect.",
          ],
        },
        {
          id: "law",
          heading: "Law",
          blocks: [`These terms are governed by the law of ${v.jurisdiction}, and its courts decide any dispute.`],
        },
        {
          id: "contact",
          heading: "Contact",
          blocks: ["Questions about these terms or your subscription? [Contact us](/contact)."],
        },
      ],
    };
  },
  tr: (v) => {
    const monthly = formatPlanAmount("monthly", "tr");
    const yearly = formatPlanAmount("yearly", "tr");
    return {
      title: "İşletme koşulları",
      summary: `Bizim Event ile ilan veren işletmeler arasındaki sözleşme: onaydan itibaren ${TRIAL_DAYS} gün ücretsiz deneme, ardından her işletme sayfası için aylık ${monthly} ya da yıllık ${yearly}, komisyon yok, istediğiniz zaman iptal.`,
      sections: [
        {
          id: "about",
          heading: "Bu koşullar hakkında",
          blocks: [
            "Bu koşullar, Bizim Event'te bir işletme sayfası oluşturduğunuzda geçerli olur ve [kullanım koşullarımız](/legal/terms) ile [gizlilik politikamızla](/legal/privacy) birlikte uygulanır. İşletmenizi incelemeye gönderdiğinizde bu koşulları işletme adına kabul ettiğinizi onaylamış olursunuz.",
            ...operatorBlock(v),
          ],
        },
        {
          id: "page",
          heading: "İşletme sayfanız ve ilanlarınız",
          blocks: [
            "İşletmeyi ilan etmeye yetkili olmalısınız ve yayınladığınız her şey doğru ve güncel olmalıdır: adlar, adresler, kapasiteler, fiyatlar, nelerin dahil olduğu ve iptal koşullarınız.",
            "İşletmenizin ihtiyaç duyduğu ruhsat, izin, kayıt ve sigortalara — örneğin işyeri ruhsatı, gıda hijyeni kaydı ya da müzik lisansları — sahip olmaktan ve çalıştığınız yerin yasalarına uymaktan siz sorumlusunuz.",
            "Yalnızca sahibi olduğunuz ya da kullanma izniniz olan ve kendi işletmenizi gösteren fotoğraf ve metinleri yükleyin.",
          ],
        },
        {
          id: "review",
          heading: "Kontrol ve onay",
          blocks: [
            "Her yeni işletmeyi ve ilanı yayınlamadan önce inceliyoruz. Değişiklik isteyebilir ya da bu koşulları karşılamayan bir işletmeyi veya ilanı reddedebiliriz; nedenini size bildiririz.",
            "Onaylanan ilanlar, aboneliğiniz geçerli olduğu sürece yayında kalır. Onaylanmış bir ilanı düzenlediğinizde değişiklikler hemen görünür; daha sonra inceleyebiliriz.",
          ],
        },
        {
          id: "trial",
          heading: "Ücretsiz deneme",
          blocks: [
            `Her işletme sayfası, onaylandığı günden başlayarak ${TRIAL_DAYS} günlük ücretsiz deneme süresi alır. Başlamak için kart gerekmez ve deneme süresince hiçbir ücret alınmaz.`,
            "Deneme süresi bitmeden size e-posta göndeririz. O zamana kadar bir plan seçmediyseniz ilanlarınız, plan seçene kadar gizlenir — silinmez.",
          ],
        },
        {
          id: "subscription",
          heading: "Abonelik ve ödeme",
          blocks: [
            {
              list: [
                `Ücret, her işletme sayfası için aylık ${monthly} ya da yıllık ${yearly} olup İngiliz sterlini cinsindendir ve geçerli vergileri içerir.`,
                "Ödemeler ödeme sağlayıcımız Stripe tarafından peşin alınır ve siz iptal edene kadar her dönemin sonunda otomatik olarak yenilenir.",
                "Ücretsiz deneme süreniz sırasında bir plan seçerseniz ilk ödeme deneme süresi bittiğinde alınır.",
                "İşletmenizin Faturalandırma sayfasından istediğiniz zaman aylık ile yıllık arasında geçiş yapabilir, kartınızı güncelleyebilir ya da iptal edebilirsiniz.",
                `Bir ödeme başarısız olursa, ödeme yeniden denenirken ilanlarınız ${GRACE_DAYS} gün boyunca yayında kalır. Bu sürenin sonunda hâlâ ödenmemişse, ödeme yapılana kadar gizlenir.`,
              ],
            },
            "Fiyatı değiştirmeden en az 30 gün önce size e-posta göndeririz. Yeni fiyat bir sonraki yenilemenizden itibaren geçerli olur ve o tarihten önce iptal edebilirsiniz.",
          ],
        },
        {
          id: "cancelling",
          heading: "İptal",
          blocks: [
            "İptal ettiğinizde ilanlarınız, ödemesini yaptığınız dönemin sonuna kadar yayında kalır, ardından gizlenir. Yasanın gerektirdiği durumlar dışında bir dönemin bir kısmı için iade yapmıyoruz.",
            "Gizlenen ilanlarınız ve işletme bilgileriniz, istediğiniz zaman geri dönebilmeniz için saklanır. İşletme sayfanızın tamamen silinmesini isterseniz [bize ulaşın](/contact).",
          ],
        },
        {
          id: "no-commission",
          heading: "Komisyon yok, rezervasyon ödemesi yok",
          blocks: [
            "Bizim Event komisyon almaz ve sizinle müşterileriniz arasındaki ödemelere aracılık etmez. Fiyatları, kaporaları, sözleşmeleri ve iadeleri müşterilerinizle doğrudan kararlaştırırsınız. Bunlardan ve gelirinizle ilgili vergilerden siz sorumlusunuz.",
          ],
        },
        {
          id: "customers",
          heading: "Müşteriler ve bilgileri",
          blocks: [
            "Taleplere dürüst ve hızlı yanıt verin; ilanlarınızda gösterilen fiyat ve koşullara uyun.",
            "Müşteriler size Bizim Event üzerinden ulaştığında bilgilerini yalnızca talepleri ya da rezervasyonlarıyla ilgilenmek için kullanın ve veri koruma yasalarına uyun. Müşterileriniz hakkında sakladığınız kişisel verilerden siz sorumlusunuz.",
            "Sahte değerlendirme istemeyin, kendi işletmenizi değerlendirmeyin ve değerlendirme karşılığında bir şey teklif etmeyin.",
          ],
        },
        {
          id: "content",
          heading: "İçeriğinizi gösterme izni",
          blocks: [
            "Yüklediğiniz metin ve fotoğrafların sahibi siz olmaya devam edersiniz. Bizim Event'in bunları Bizim Event'te göstermesine, yeniden boyutlandırmasına, kırpmasına ve çevirmesine, ayrıca ilanlarınızı ve siteyi tanıtmak için kullanmasına izin verirsiniz. Bu izin, içerik Bizim Event'te kaldığı sürece (ve sonrasında kısa bir süre yedeklerde) geçerlidir.",
          ],
        },
        {
          id: "removal",
          heading: "Bir işletme sayfasının gizlenmesi veya kaldırılması",
          blocks: [
            "Bu koşullara ya da yasaya aykırı olan veya müşterilerin bildirdiği ve yanıltıcı bulduğumuz bir işletme sayfasını ya da ilanı gizleyebilir veya kaldırabiliriz. Uygun olduğunda önce sizi uyarır ve düzeltmeniz için fırsat veririz.",
          ],
        },
        {
          id: "liability",
          heading: "Sorumluluk",
          blocks: [
            "Bizim Event'i işletmeniz için kullanırsınız. Herhangi bir 12 aylık dönemde size karşı toplam sorumluluğumuz, o dönemde bize ödediğiniz abonelik ücretleriyle sınırlıdır; kâr, iş veya itibar kaybından ya da diğer dolaylı kayıplardan sorumlu değiliz. Yasanın sınırlanmasına izin vermediği sorumluluklar bu sınırlamanın dışındadır.",
            "Hizmetlerinizden ya da yayınladığınız içerikten doğan taleplerden siz sorumlusunuz.",
          ],
        },
        {
          id: "changes",
          heading: "Koşullardaki değişiklikler",
          blocks: [
            "Bu koşulları güncelleyebiliriz. Önemli değişiklikleri yürürlüğe girmeden en az 30 gün önce size e-postayla bildiririz.",
          ],
        },
        {
          id: "law",
          heading: "Hukuk",
          blocks: [
            `Bu koşullar ${v.jurisdiction} hukukuna tabidir ve uyuşmazlıklar ${v.jurisdiction} mahkemelerinde çözülür.`,
          ],
        },
        {
          id: "contact",
          heading: "İletişim",
          blocks: ["Bu koşullar ya da aboneliğinizle ilgili sorularınız mı var? [Bize ulaşın](/contact)."],
        },
      ],
    };
  },
};
