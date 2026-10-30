# Derin Deniz — Denizaltı Avı

## Gereksinimler

- Node.js 20.9 veya üzeri
- npm

## Yerel geliştirme

Proje klasöründe:

```bash
npm ci
npm run dev
```

Site ve Socket.IO oyun sunucusu birlikte `http://localhost:3000` adresinde başlar.

## Üretim sunucusu

Bu proje, Next.js uygulaması ile Socket.IO'yu aynı Node.js HTTP sunucusunda çalıştıran bir custom server kullanır. WebSocket bağlantılarını ve uzun süre çalışan Node.js süreçlerini destekleyen bir VPS veya uygulama servisi kullanın; serverless/edge işlevleri (ör. Vercel Functions) bu sunucu modeli için uygun değildir.

Sunucuda:

```bash
npm ci
npm run build
npm start
```

Sunucu `PORT` değişkenini kullanır (varsayılan `3000`) ve `HOST` belirtilmezse `0.0.0.0` adresinde dinler. Reverse proxy kullanıyorsanız WebSocket `Upgrade` bağlantılarını uygulamaya iletecek şekilde yapılandırın.

Oda ve balık durumları şu an sunucu belleğinde tutulur. Bu nedenle eşzamanlı oyuncular aynı sunucu sürecine bağlanmalıdır; yatay ölçekleme, birden fazla worker veya birden fazla replika açmayın. Çoklu sunucu desteği için Socket.IO adapter'ı yanında oyun odası/balık durumunu da paylaşan merkezi bir depolama katmanı gerekir. Son oyuncu odadan çıkınca veya sunucu yeniden başlayınca oda silinir.

## Aynı ağdan çok oyunculu oyun

1. Sunucuyu çalıştıran bilgisayarın yerel IPv4 adresini bulun (`ipconfig` komutundaki IPv4 adresi).
2. Diğer cihazlarda `http://<bilgisayarın-IP-adresi>:3000` adresini açın. Örneğin: `http://192.168.1.25:3000`.
3. Bir oyuncu yeni oda oluşturur ve ekranda görünen 6 haneli kodu paylaşır. Diğer oyuncular aynı kodu girerek odaya katılır.

Sunucu `0.0.0.0` adresinde dinler ve başlarken yerel ağ adreslerini terminalde listeler. Windows Güvenlik Duvarı bağlantı izni isterse özel ağlarda izin verin. Farklı ağlardaki oyuncular, üretime dağıtılmış aynı HTTPS adresini açıp aynı 6 haneli oda kodunu girebilir. Oda kodu paylaşılabilir; herkese açık sunucuda gizli oda/kimlik doğrulama özelliği yoktur.

## GitHub'a aktarma

GitHub'da boş bir repository oluşturun, ardından proje klasöründe repository adresini kendi adresinizle değiştirerek çalıştırın:

```bash
git add .
git commit -m "Prepare game for deployment"
git branch -M main
git remote add origin https://github.com/<kullanici>/<repository>.git
git push -u origin main
```

Her push'ta GitHub Actions bağımlılıkları kurar, lint ve production build kontrollerini çalıştırır. Sunucu platformunda repository'yi bağlayıp build komutu olarak `npm run build`, start komutu olarak `npm start` kullanın.
