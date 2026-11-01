# Kararlar

Kullanıcının açık sözüyle alınmış kararlar. Silinmez; değişirse "yerini aldı: K-yy" diye işaretlenir.

| No | Tarih | Karar | Bekçi |
|---|---|---|---|
| K-01 | 2026-11-01 | Yapı düz HTML/CSS/JS; build adımı yok, dosyaya çift tıklayınca çalışır, GitHub Pages'e doğrudan konur. | `index.html` yalnız klasik `<script src>` kullanır; `type="module"` yok (tests/guard.test.js). |
| K-02 | 2026-11-01 | Mod 1 kullanıcının kendi anahtarıyla çalışır (Claude, OpenAI uyumlu uç nokta / kendi proxy, Gemini). Sunucu tarafı yok. | Kaynakta sabit API anahtarı yok (tests/guard.test.js). |
| K-03 | 2026-11-01 | Arayüz Türkçe + İngilizce. | Her TR anahtarının EN karşılığı var (tests/guard.test.js). |
| K-04 | 2026-11-01 | Görsel dünya "Çek Koçanı": güvenlik baskılı çek/senet dili. İhale platformu birebir kopyalanmaz. | DESIGN.md |
| K-05 | 2026-11-01 | Sitede ikon ve emoji yok (genel kullanıcı kuralı). | tests/guard.test.js emoji taraması |
| K-06 | 2026-11-02 | Sayfa tam sola dayalı; ortalanmış en-genişlik yok. Sağdaki boşlukta paketler kalıcı bir panelde durur (arama + kategori). | `.duzen` margin auto yok; `#paketDok` var (tests/guard.test.js) |
| K-07 | 2026-11-02 | Logo metni "MKG", ürün adı "Mukayese" (Mukayese Çeki denmez). | tests/guard.test.js ad taraması |
| K-08 | 2026-11-02 | Çek görsel dili kalır ama arayüz metinlerinde çek terimleri kullanılmaz: "Çek defteri" yerine "Teklif defteri", "Koçan" yerine "Karar özeti"; "Ödeyiniz", "Yalnız", "Mürekkep", "Çekin arkası" gibi etiketler yok. | tests/guard.test.js i18n taraması |
| K-10 | 2026-11-02 | Üç veri giriş modu (1 Yapay zekâ, 2 Kopyala-yapıştır köprüsü, 3 Elle giriş / Excel şablonu) sayfada karar kartının altında hep açık bir bölümde durur; çekmeceye ya da düğmenin arkasına saklanmaz. | `#giris` bölümünde 3 sekme (tests/guard.test.js) |
| K-09 | 2026-11-02 | Sayı kutularında tarayıcının artırma okları yok; parametre şeridinde temaya uygun − / + düğmeleri var. | css `::-webkit-inner-spin-button` gizli |
