# Orbit TV — Web

IPTV plejer (Xtream Codes klijent) koji radi u bilo kom browseru, na bilo kom uređaju/platformi (desktop, mobilni, tablet) — nema instalacije, samo se pokrene mali lokalni server i otvori stranica.

Ima iste funkcije kao Android verzija: više profila za prijavu, Live TV sa pravom EPG vremenskom mrežom, Filmovi, Serije (sezone/epizode), mini-plejer, pun plejer sa titlovima/audio zapisima/brzinom/pamćenjem pozicije, i prekidač jezika (engleski/srpski).

## Zašto postoji server.js

Xtream Codes paneli skoro nikad ne šalju CORS zaglavlja, pa browser blokira direktne pozive iz JavaScripta ka `player_api.php` i ka samom video strimu. `server.js` je mali Node/Express proxy koji:

1. **`/api/login`** – prosleđuje prijavu ka `player_api.php` i proverava `user_info.auth`.
2. **`/api/proxy`** – prosleđuje sve ostale API pozive (kategorije, kanali, EPG, filmovi, serije — generički prosleđuje bilo koju `action`).
3. **`/stream`** – prosleđuje `.m3u8`/`.ts`/`.mp4`/`.mkv` strim; za `.m3u8` playliste prepisuje sve linije tako da i segmenti idu kroz isti proxy (rešava CORS za sam video), a za obične fajlove (filmovi/epizode) prosleđuje `Range` zaglavlje radi premotavanja.

Iz bezbednosnih razloga, proxy dozvoljava prosleđivanje samo ka serveru na koji si se uspešno ulogovao (ne radi kao otvoreni relej ka bilo kom URL-u).

**Napomena:** `hls.js` (biblioteka za puštanje HLS videa) je uključen direktno u `public/hls.min.js` — ne učitava se sa spoljašnjeg CDN-a. Ovo je namerno: neke mreže, antivirusi ili firewall pravila blokiraju spoljašnje CDN skripte, što bi tiho pokvarilo ceo video bez ikakve vidljive greške.

## Pokretanje

```bash
npm install
npm start
```

Zatim otvori `http://localhost:3000` u browseru — radi identično na telefonu, tabletu ili desktopu jer je to obična web stranica (samo mora da bude na istoj mreži kao server, ili ga hostuj negde da bude dostupan svuda).

## Pokretanje bez otvorenog terminala (Windows)

Ako ne želiš da držiš prozor terminala otvoren dok koristiš app, u folderu se nalaze dve datoteke:

- **`start-hidden.vbs`** – dupli klik pokreće server **potpuno u pozadini**, bez ikakvog vidljivog prozora. Iskoči mala poruka da potvrdi da je krenulo, pa je zatvoriš i otvoriš `http://localhost:3000`.
- **`stop-server.vbs`** – dupli klik gasi server kad ti više ne treba.

Server ostaje pokrenut sve dok ga ne ugasiš preko `stop-server.vbs` (ili ne restartuješ računar). Ako želiš da se **sam pokrene** kad upališ Windows: napravi prečicu (desni klik na `start-hidden.vbs` → "Kreiraj prečico") i prevuci je u folder za pokretanje pri startu — pritisni `Win+R`, ukucaj `shell:startup`, Enter, pa prečicu ubaci tu.

(Napomena: `npm install` i dalje moraš pokrenuti bar jednom ručno pre prve upotrebe, isto kao ranije.)

## Profili (više naloga)

Prvi ekran je lista sačuvanih profila (čuvaju se u `localStorage` browsera, ne šalju se nigde osim tvom Xtream serveru):
- **Dodaj profil** – forma proverava podatke pravim pozivom ka `player_api.php` pre čuvanja
- Klik na profil = prijava
- Ikonica olovke = izmena, ikonica kante = brisanje (uz potvrdu)

## Live TV / Filmovi / Serije

Prebacuje se ikonicama u levoj traci:
- **Live TV** – kategorije sa strane, mini-plejer ugrađen u hero panel (kanal se odmah pušta nemo u malom prozoru), traka kanala, i prava EPG vremenska mreža (sat-po-sat lenjir, zaleđena kolona kanala, blokovi proporcionalni trajanju, crvena "sada" linija).
- **Filmovi** – kategorije + mreža postera. Klik odmah pušta film preko celog ekrana.
- **Serije** – kategorije + mreža postera. Klik otvara ekran sa opisom i epizodama grupisanim po sezonama; klik na epizodu je pušta.

## Pun plejer (preko celog ekrana)

Otvara se klikom na ikonicu širenja (Live TV) ili klikom na film/epizodu:
- Premotavanje 10s nazad/napred
- **Playback speed** (0.5x–2x)
- **Audio track** – bira među dostupnim audio zapisima (hls.js `audioTracks`)
- **Subtitles** – bira titl ili "Off" ako ih sadržaj ima (hls.js `subtitleTracks`); dugme se ne prikazuje za uživo kanale
- **Nastavi gde si stao** – pozicija za filmove/epizode se čuva u `localStorage` i automatski nastavlja sledeći put
- Fullscreen dugme, klik-za-premotavanje na traci napretka

## Jezik

Ikonica globusa (na ekranu profila i u glavnoj traci) otvara izbor English/Srpski. Prevodi su u `public/i18n.js` — dodavanje trećeg jezika je kopiranje bloka i prevod vrednosti.

## Deljenje sa drugovima preko interneta (ngrok)

Ako drug nije na istoj WiFi mreži nego bilo gde na svetu, najlakši besplatan način je **ngrok** — pravi privremeni javni link koji vodi do tvog servera.

**Podešavanje (radiš samo jednom):**

1. Idi na **https://ngrok.com** i napravi besplatan nalog (email + lozinka).
2. Nakon prijave, sajt te vodi na stranicu **"Setup & Installation"** — izaberi **Windows**.
3. Preuzmi ngrok (zip fajl), raspakuj ga — dobićeš jedan fajl **`ngrok.exe`**.
4. **Prebaci `ngrok.exe` direktno u `orbit-tv` folder** (isti onaj sa `server.js`, `package.json`...). Ovo je bitno da bi `start-ngrok.bat` mogao da ga nađe.
5. Na ngrok sajtu (ista stranica "Setup & Installation") piše komanda za autentikaciju, izgleda otprilike ovako:
   ```
   ngrok config add-authtoken 2AbCdEfGhIjKlMnOpQrStUv_xxxxxxxxxxxxx
   ```
   Otvori terminal **u `orbit-tv` folderu** (isto kao i ranije — desni klik na prazan prostor → "Odpri v terminalu"), nalepi tu komandu tačno kako je ngrok sajt dao (sa tvojim tokenom, ne ovim iz primera), pritisni Enter. Ovo se radi samo jednom, ngrok pamti token trajno.

**Svaki put kad hoćeš da pustiš drugove da gledaju:**

1. Pokreni Orbit TV server kao i obično — `npm start` ili dupli klik na `start-hidden.vbs`.
2. Dupli klikni **`start-ngrok.bat`**.
3. Sačekaj par sekundi — pojaviće se red koji počinje sa **`Forwarding`**, npr:
   ```
   Forwarding    https://a1b2-89-100-50-1.ngrok-free.app -> http://localhost:3000
   ```
4. **Kopiraj taj `https://....ngrok-free.app` link i pošalji drugu** (WhatsApp, Viber, šta god). On ga otvori u svom browseru — radi sa bilo kog mesta na svetu, na telefonu ili računaru.
5. Prozor sa ngrok-om (taj crni terminal) mora ostati otvoren dok drug gleda — kad ga zatvoriš, link prestaje da radi.

**Napomene:**
- Besplatni ngrok link se **menja svaki put** kad ponovo pokreneš `start-ngrok.bat` — ako želiš da uvek bude isti link, to zahteva plaćeni ngrok plan (fiksni subdomain).
- Svako ko dobije link može sam da doda **svoj** Xtream Codes profil na ekranu Orbit TV — profili se čuvaju lokalno u browseru te osobe, niko ne vidi tuđe naloge.
- Prvi put kad pokreneš server, Windows Firewall može da pita "Allow Node.js through firewall?" — klikni **Allow** (barem za privatne mreže) da sve radi glatko.

## Trajno rešenje (bez tvog računara upaljenog)

Ako želiš da drugovi mogu da pristupe **bilo kad**, čak i kad je tvoj računar ugašen, hostuj app na **GitHub + Render.com** — oboje besplatno. Ovo je najstabilnije rešenje jer nema veze sa tvojim računarom, terminalom ili ngrok linkovima koji se menjaju.

### Korak 1 — GitHub nalog i repozitorijum

1. Idi na **https://github.com**, napravi besplatan nalog (ako ga nemaš)
2. Klikni zeleno dugme **"New"** (ili + gore desno → "New repository")
3. Daj mu ime, npr. `orbit-tv`, ostavi **Private** ili **Public** (svejedno je za ovo), **NE** čekiraj "Add a README file" (već imamo jedan)
4. Klikni **"Create repository"**

### Korak 2 — Otpremi fajlove (bez ikakvih komandi, preko browsera)

1. Na stranici novog repozitorijuma, klikni link **"uploading an existing file"** (piše u sredini stranice)
2. **Prevuci ceo sadržaj `orbit-tv` foldera** (sve fajlove i `public` folder) u taj prozor za upload
   - **Ne prevlači `node_modules` folder** ako postoji kod tebe lokalno (Render ga sam pravi)
3. Skroluj dole, klikni **"Commit changes"**

### Korak 3 — Poveži sa Render.com

1. Idi na **https://render.com**, napravi besplatan nalog — najlakše preko **"Sign up with GitHub"** (poveže se automatski)
2. Na Render dashboard-u klikni **"New +"** → **"Web Service"**
3. Izaberi svoj `orbit-tv` repozitorijum sa liste (Render ga vidi jer si se ulogovao preko GitHub-a)
4. Podešavanja:
   - **Name**: bilo šta, npr. `orbit-tv`
   - **Region**: najbliži tebi
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Klikni **"Create Web Service"**

Render sad sam instalira zavisnosti i pokreće server. Za par minuta dobićeš stalan link tipa:
```
https://orbit-tv-xxxx.onrender.com
```
Taj link radi **uvek**, sa bilo kog mesta, bez ikakvog terminala ili tvog upaljenog računara — samo ga pošalješ drugovima.

**Napomene:**
- Besplatni Render plan "uspava" server posle 15 min neaktivnosti — prvo otvaranje posle pauze traje par sekundi duže dok se probudi, to je normalno.
- Svaki put kad promeniš fajlove i ponovo ih otpremiš na GitHub (uploading files opet, ili preko git-a ako naučiš), Render sam automatski ponovo deploy-uje.
- Ako kasnije budeš menjao kod, možeš i preko GitHub web editora (klik na fajl → olovka za izmenu) bez ikakvih komandi.



## Instalacija kao aplikacija (radi na svim platformama)

Orbit TV je podešen kao **PWA (Progressive Web App)** — znači da se instalira i otvara kao prava aplikacija (svoja ikonica, svoj prozor bez browser trake), na Android-u, iPhone-u, Windows-u, Mac-u i Linux-u, bez ikakvog dodatnog app store-a.

**Android / Windows / Mac (Chrome, Edge):**
- Kad otvoriš `http://localhost:3000` (ili ngrok link), na ekranu Orbit TV ekrana profila pojaviće se dugme **"Install app"** — klikni ga i potvrdi.
- Ili: klikni ikonicu instalacije u adresnoj traci browsera (⊕ ili ekran-sa-strelicom, zavisno od browsera).
- Posle instalacije, Orbit TV se pojavljuje kao zasebna aplikacija (Start meni / Launchpad / app drawer), sa svojom ikonicom.

**iPhone/iPad (Safari):**
- iOS ne podržava automatsko dugme za instalaciju, ali ide ručno: otvori link u Safari-ju → dugme za deljenje (kvadrat sa strelicom) → **"Add to Home Screen"**.
- Pojaviće se ikonica na home ekranu, otvara se kao prava aplikacija (bez Safari trake).

**Napomena:** instalacija (i "Install app" dugme) rade preko `http://localhost:3000` i preko ngrok linka (koji je uvek `https://`), ali **ne rade** preko običnog LAN IP-a (npr. `http://192.168.1.23:3000`) — to je ograničenje browsera, ne aplikacije: instalacija zahteva ili `https://` ili `localhost`. Sama aplikacija i dalje radi normalno preko LAN IP-a, samo bez opcije instalacije.

Logo/ikonica se nalazi u `public/icons/` (generisane iz trenutnog Orbit TV znaka). Ako želiš svoj logo umesto ovog, pošalji mi sliku pa je zamenim za sve veličine odjednom.

## Struktura projekta

```
orbit-tv/
├── package.json
├── server.js          # Express backend + proxy (CORS + HLS/VOD stream proxy)
├── start-hidden.vbs    # (Windows) pokreni server u pozadini bez terminala
├── stop-server.vbs     # (Windows) ugasi server pokrenut preko start-hidden.vbs
├── start-ngrok.bat     # (Windows) javni link za drugove preko ngrok-a
└── public/
    ├── index.html      # sve: profili, glavni app, detalji serije, pun plejer
    ├── style.css
    ├── i18n.js         # rečnik (en/sr) + pomoćne funkcije
    ├── app.js          # sva logika: profili, Xtream API, EPG, plejer
    ├── hls.min.js      # hls.js biblioteka, ugrađena lokalno (ne sa CDN-a)
    ├── manifest.json   # PWA manifest (ime, boje, ikonice)
    ├── sw.js           # service worker (potreban da se app može instalirati)
    └── icons/          # generisane ikonice aplikacije (192/512/maskable/apple-touch)
```

## Ograničenja / napomene

- Ovo je klijent za standardni **Xtream Codes API** (`player_api.php`) – radi sa svakim panelom koji tu specifikaciju podržava.
- EPG (`get_short_epg`) se učitava po kanalu; prikazano je do 25 vidljivih kanala odjednom (radi brzine). Menja se u `app.js` (`state.channels.slice(0, 25)`).
- Mini-plejer je utišan (nema zvuk) dok samo pregledaš kanale — zvuk kreće kad otvoriš pun ekran. Menja se u `playMini()` ako želiš zvuk odmah.
- Titlovi/audio zapisi zavise isključivo od toga šta provajder/sadržaj stvarno nudi (hls.js čita direktno iz HLS manifesta); ako ih nema, dugme javlja da nema dostupnih.
- Catch-up/DVR (vraćanje kroz TV vodič na prošle emisije) nije implementiran.
- Ne pokreći ovaj proxy javno na internetu bez dodatne autentikacije – iako je ograničen na jedan host po sesiji, i dalje je proxy koji prosleđuje sadržaj.
