# EGGRIFT

Boyutlar arasında geçiş yapan yumurta zırhlı şövalyenin 2D aksiyon platform oyunu.

**Oyna:** https://ruzgaregeermn00-maker.github.io/eggblade/

## Yarık mekaniği

Harita tek bir tilemap. Her karo hangi boyutta katı olduğunu kendisi biliyor, bu yüzden
boyut değiştirmek tek bir değişkeni çevirmekten ibaret — seviye yeniden kurulmaz.

| Karo | Geçmiş (yeşil) | Gelecek (camgöbeği) |
| --- | --- | --- |
| Sarmaşık | tırmanılır | çürümüş, boşluk |
| Harabe | katı zemin | yıkılmış, geçilir |
| Metal platform | hologram taslak | katı, enerjili |
| Lazer | uyuyan yayıcı | öldürücü ışın |

Bu yüzden geçmişte harabeler yolu keser, gelecekte lazerler; koridoru geçmenin tek
yolu ikisi arasında sırayla geçiş yapmak. Havadayken de geçiş yapılabilir, boşluk
üzerindeki platform bölümü buna dayanır. Şövalye katı maddenin içine ışınlanamaz:
geçiş önce birkaç piksel itmeyi dener, olmazsa reddedilir.

## Kontroller

| Tuş | İşlev |
| --- | --- |
| `A` `D` / `←` `→` | Hareket |
| `W` / `↑` | Zıpla, duvar zıplaması |
| `S` / `↓` | Tek yönlü platformdan in |
| `SPACE` / Sol tık | Kılıç darbesi |
| `SHIFT` / `E` | Boyut değiştir |
| `ESC` / `P` | Duraklat · `M` sesi kapat |

Dokunmatik cihazlarda ekran kontrolleri otomatik açılır.

## Yapı

| Dosya | İçerik |
| --- | --- |
| `index.html` | Sayfa iskeleti, menüler, dokunmatik pad |
| `style.css` | Çerçeve, overlay'ler, 16:9 letterbox |
| `physics.js` | Tilemap dünyası, çift boyutlu çarpışma, duvar teması |
| `renderer.js` | Prosedürel tileset, parallax gökyüzü, karakterler, HUD, yarık efekti |
| `audio.js` | Web Audio ile sentezlenen ses efektleri |
| `game.js` | Seviye, düşmanlar, boss, HUD mantığı, oyun döngüsü |

Hiç görsel veya ses dosyası yok — her piksel ve her ses çalışma anında üretiliyor,
bu yüzden GitHub Pages'te 404 verebilecek hiçbir varlık bağlantısı bulunmuyor.
Sahne 480×270'lik bir tampona çizilip CSS ile `image-rendering: pixelated`
büyütülüyor; pixel-art görünümü buradan geliyor.

Fizik sabit 60 Hz adımlarla, çizim ekran tazeleme hızında çalışır — yüksek Hz
ekranlarda oyun hızlanmaz.

## Bölüm

Varış → sarmaşık duvarı (geçmiş tırmanışı) → havada boyut değiştirme boşluğu →
lazer/harabe koridoru → duvar zıplama kuyusu → **Yarık Muhafızı**.

Muhafızın saldırıları oyuncunun bulunduğu boyuta göre değişir: geçmişte yer çarpması
ve spor yaylımı, gelecekte lazer süpürme ve drone çağırma. Zırhı her döngüde açılır;
hasar sadece çekirdek açıkken geçer.
