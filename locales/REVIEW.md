# Translation review queue

Keys below have a best-effort translation already committed to `or.json` (never left blank),
but should be checked by a native/fluent Odia speaker before shipping — register, naturalness,
or terminology I wasn't fully confident about.

## Glossary — pick once, use everywhere

One term per concept, chosen for Ola/Uber-register Hindi and conversational Odia. When a new
batch needs one of these concepts, reuse the term below rather than re-deriving it. If a batch
turns up an existing key that drifted from this table, fix it in that batch and note the fix in
the batch's checkpoint.

| Concept (en) | Hindi | Odia | Notes |
|---|---|---|---|
| ride / trip | राइड (pl. राइड्स) | ରାଇଡ୍ | One term for both English "ride" and "trip" — they're the same concept to the user. Loanword kept, matches Ola/Uber Hindi UI convention. Fixed in `history.*` during Batch 2 (was ट्रिप/ଟ୍ରିପ୍). |
| fare | किराया | ଭଡ଼ା | |
| driver | ड्राइवर | ଡ୍ରାଇଭର୍ | |
| booking / to book | बुकिंग / बुक करें | ବୁକିଂ / ବୁକ୍ କରନ୍ତୁ | |
| cancel | रद्द करें | ବାତିଲ୍ କରନ୍ତୁ | |
| pickup | पिकअप | ପିକଅପ୍ | |
| drop | ड्रॉप | ଡ୍ରପ୍ | |
| vehicle | वाहन / गाड़ी | ଗାଡ଼ି | "गाड़ी" used in casual booking copy (e.g. "अपना वाहन प्रकार चुनें" uses वाहन for the formal "vehicle type" label; गाड़ी elsewhere is fine for casual "choose a vehicle") |
| confirm | कन्फर्म करें | କନ୍ଫର୍ମ କରନ୍ତୁ | |
| payment | पेमेंट | ପେମେଣ୍ଟ | Loanword, not भुगतान — fixed in `booking.payment.title` during Batch 2. |
| account | अकाउंट | ଆକାଉଣ୍ଟ | |
| emergency | इमरजेंसी | ଜରୁରୀକାଳୀନ | Load-bearing for ambulance/safety strings — see emergency-content rule below. |
| saved place | सेव की गई जगह | ସେଭ୍ କରାଯାଇଥିବା ସ୍ଥାନ | |

### Emergency-content rule (ambulance/safety screens)

Medical and emergency strings must use the plainest, most unambiguous phrasing available —
never a "natural-sounding" idiom if a literal, plain rendering is clearer. Every hi/or
translation touching ambulance or safety content is flagged below for native review
regardless of how confident the translation felt, because a mistranslated emergency string
is a different class of bug than a mistranslated UI label.

## Batch 1 — Odia (or.json)

- `home.upcoming.cancelAlert.message` — "This ride hasn't been dispatched yet — cancelling is free. Cancel it?"
  My attempt: "ଏହି ରାଇଡ୍ ଏପର୍ଯ୍ୟନ୍ତ ଡିସ୍ପାଚ୍ ହୋଇନାହିଁ — ବାତିଲ୍ କରିବା ମାଗଣା। ବାତିଲ୍ କରିବେ?"
  Unsure whether "ଡିସ୍ପାଚ୍" (transliterated) reads naturally in conversational Odia vs. a native paraphrase.

- `booking.errors.riderIdMissing` — "Could not identify your rider account. Please log out and log in again."
  My attempt: "ଆପଣଙ୍କର ରାଇଡର୍ ଆକାଉଣ୍ଟ ଚିହ୍ନଟ ହୋଇପାରିଲା ନାହିଁ। ଦୟାକରି ଲଗଆଉଟ୍ କରି ପୁଣି ଲଗଇନ୍ କରନ୍ତୁ।"
  Longer instructional sentence — want a native check on flow/tone.

- `locationPicker.saveAlert.title` — "Save this place as..."
  My attempt: "ଏହି ସ୍ଥାନକୁ ଏହିପରି ସେଭ୍ କରନ୍ତୁ..."
  This is an Alert.alert title paired with option buttons (Home/Office/Custom) — want confirmation the phrasing reads as a prompt, not a command.

- `profile.home.signOutAlert.message` — "You will be logged out."
  My attempt: "ଆପଣ ଲଗଆଉଟ୍ ହୋଇଯିବେ।"
  Passive construction — check this is the natural way to phrase it vs. an active alternative.

- `history.status.*` and `notifications.types.*` — single-word status/type labels (e.g. "in progress" → "ଚାଲିଛି", "announcement" → "ଘୋଷଣା").
  These are terse UI badge words; flagging the set for a quick native pass to confirm they're the terms an Odia rider would expect, not just literal dictionary equivalents.

- `home.savedPlaces.emptySub` — "After booking, you can save your pickup or drop as Home, Office, or any custom label"
  My attempt: "ବୁକିଂ ପରେ, ଆପଣ ଆପଣଙ୍କର ପିକଅପ୍ କିମ୍ବା ଡ୍ରପ୍‌କୁ ହୋମ୍, ଅଫିସ୍ କିମ୍ବା ଯେକୌଣସି କଷ୍ଟମ୍ ଲେବଲ୍ ଭାବରେ ସେଭ୍ କରିପାରିବେ"
  Long compound sentence — want a fluency check.

Hindi (hi.json) translations for this batch are higher-confidence and not flagged, but a native pass is still worthwhile before ship.

## Batch 2 — cab/booking, cab/review, cab/vehicles, cab/coupons, cab/rentals, truck/*, ambulance/*

### ⚠️ Ambulance — EVERY hi/or translation flagged (emergency-content rule)

Per the emergency-content rule above, every Hindi and Odia string touching `ambulance.*` is
listed below regardless of confidence. None are blocking — each has a plain-language best
attempt already committed — but this whole table needs a native medical/emergency-context
review pass before ship. A few terms called out specifically because a simpler alternative
was considered and rejected in favor of precision:

- **Defibrillator** (`ambulance.vehicles.equipment.Defibrillator`) — kept as transliteration
  (डिफिब्रिलेटर / ଡିଫିବ୍ରିଲେଟର୍) in both languages; no common plain-language equivalent exists.
  Confirm this is what riders/families would recognize on an equipment list under stress.
- **IV Fluids** (`ambulance.vehicles.equipment.IV Fluids`) — kept as "IV फ्लुइड्स" / "IV ଫ୍ଲୁଇଡ୍ସ"
  rather than a literal translation ("नस के ज़रिए तरल" / "ନଳୀ ଦ୍ୱାରା ତରଳ") which felt more
  confusing than the widely-recognized loanword. Confirm.
- **"ICU on wheels"** (`ambulance.subTypes.alsDesc`, `ambulance.vehicles.meta.als.desc`) — the
  English source uses a vehicle metaphor; both hi/or translations replaced it with a literal
  "ICU-like facility" (आईसीयू जैसी सुविधा / ICU ପରି ସୁବିଧା) to avoid the metaphor reading as
  confusing or untranslatable. Confirm this doesn't lose meaning for someone deciding between
  BLS and ALS in an emergency.
- **Dead Body Transfer** (`ambulance.purposes.dead_body`) — translated as शव परिवहन / ମୃତଦେହ
  ପରିବହନ (plain "body transport", matching common Indian ambulance-service signage) rather
  than a softer euphemism, to stay unambiguous. Confirm register is acceptable, not harsh.
- **Oxygen** (`ambulance.vehicles.equipment.Oxygen`, and inside `blsDesc`) — used the formal/
  textbook Odia अम्ल जान — ଅମ୍ଳଜାନ — rather than the transliteration ଅକ୍ସିଜେନ୍. Both are
  widely understood in Odisha; flagging so a native speaker can confirm ଅମ୍ଳଜାନ is what
  appears on real ambulance/hospital signage rather than a bookish word people don't say aloud.

Full table (English source → Hindi → Odia) for every `ambulance.*` key added in Batch 2:

Key | English | Hindi | Odia
---|---|---|---
`ambulance.booking.ambulanceTypeRequired` | Ambulance Type Required * | आवश्यक एम्बुलेंस प्रकार * | ଆବଶ୍ୟକ ଆମ୍ବୁଲାନ୍ସ ପ୍ରକାର *
`ambulance.booking.bannerFree` | 🆓 Free Service — No charges will be applied | 🆓 फ्री सेवा — कोई शुल्क नहीं लगेगा | 🆓 ମାଗଣା ସେବା — କୌଣସି ଚାର୍ଜ ଲାଗିବ ନାହିଁ
`ambulance.booking.bannerPaid` | 🚑 Paid Service — Charges based on service type | 🚑 पेड सेवा — सेवा के प्रकार अनुसार शुल्क | 🚑 ପେଡ୍ ସେବା — ସେବା ପ୍ରକାର ଅନୁସାରେ ଚାର୍ଜ
`ambulance.booking.confirmChooseHospital` | Confirm & Choose Hospital → | कन्फर्म करें और अस्पताल चुनें → | କନ୍ଫର୍ମ କରନ୍ତୁ ଏବଂ ଡାକ୍ତରଖାନା ବାଛନ୍ତୁ →
`ambulance.booking.confirmRequestFree` | Confirm & Request Free → | कन्फर्म करें और फ्री रिक्वेस्ट करें → | କନ୍ଫର୍ମ କରନ୍ତୁ ଏବଂ ମାଗଣା ରିକୱେଷ୍ଟ କରନ୍ତୁ →
`ambulance.booking.contactPhonePlaceholder` | Contact Mobile Number * | संपर्क मोबाइल नंबर * | ଯୋଗାଯୋଗ ମୋବାଇଲ୍ ନମ୍ବର *
`ambulance.booking.deadBodyModal.body` | We offer respectful and dignified transfer services... | हम शव का सम्मानजनक और गरिमापूर्ण परिवहन प्रदान करते हैं... | ଆମେ ମୃତଦେହର ସମ୍ମାନଜନକ ଏବଂ ଗରିମାପୂର୍ଣ୍ଣ ପରିବହନ ପ୍ରଦାନ କରୁ...
`ambulance.booking.deadBodyModal.confirm` | I Understand, Proceed | मैं सहमत हूं, आगे बढ़ें | ମୁଁ ସହମତ, ଆଗକୁ ବଢ଼ନ୍ତୁ
`ambulance.booking.deadBodyModal.title` | Respectful Transfer Service | सम्मानजनक परिवहन सेवा | ସମ୍ମାନଜନକ ପରିବହନ ସେବା
`ambulance.booking.dropLocationLabel` | Drop Location * | ड्रॉप लोकेशन * | ଡ୍ରପ୍ ଲୋକେସନ୍ *
`ambulance.booking.dropPlaceholder` | Tap to search hospitals or any location | अस्पताल या कोई भी लोकेशन खोजने के लिए टैप करें | ଡାକ୍ତରଖାନା କିମ୍ବା ଯେକୌଣସି ଲୋକେସନ୍ ଖୋଜିବାକୁ ଟାପ୍ କରନ୍ତୁ
`ambulance.booking.dropSearchPlaceholder` | Search hospitals or any address... | अस्पताल या कोई पता खोजें... | ଡାକ୍ତରଖାନା କିମ୍ବା କୌଣସି ଠିକଣା ଖୋଜନ୍ତୁ...
`ambulance.booking.freeService` | Free Service | फ्री सेवा | ମାଗଣା ସେବା
`ambulance.booking.medicalNotesPlaceholder` | Any special requirements, medical conditions, oxygen need, wheelchair, etc. | कोई खास ज़रूरत, मेडिकल स्थिति, ऑक्सीजन की ज़रूरत, व्हीलचेयर, आदि। | କୌଣସି ବିଶେଷ ଆବଶ୍ୟକତା, ମେଡିକାଲ୍ ସ୍ଥିତି, ଅମ୍ଳଜାନ ଆବଶ୍ୟକତା, ହୁଇଲଚେୟାର୍, ଇତ୍ୟାଦି।
`ambulance.booking.medicalNotesTitle` | Medical Notes (optional) | मेडिकल नोट्स (वैकल्पिक) | ମେଡିକାଲ୍ ନୋଟ୍ସ (ଇଚ୍ଛାଧୀନ)
`ambulance.booking.nearbyHospitalsSection` | 🏥 Nearby Hospitals | 🏥 आस-पास के अस्पताल | 🏥 ନିକଟସ୍ଥ ଡାକ୍ତରଖାନା
`ambulance.booking.noResults` | No results found. Try a different search. | कोई परिणाम नहीं मिला। दूसरी खोज करें। | କୌଣସି ଫଳାଫଳ ମିଳିଲା ନାହିଁ। ଅନ୍ୟ ଖୋଜ କରନ୍ତୁ।
`ambulance.booking.paidService` | Paid Service | पेड सेवा | ପେଡ୍ ସେବା
`ambulance.booking.patientContactTitle` | Patient & Contact Details * | मरीज़ और संपर्क विवरण * | ରୋଗୀ ଏବଂ ଯୋଗାଯୋଗ ବିବରଣୀ *
`ambulance.booking.patientNamePlaceholder` | Patient Name * | मरीज़ का नाम * | ରୋଗୀଙ୍କ ନାମ *
`ambulance.booking.pickupLocationLabel` | Pickup Location * | पिकअप लोकेशन * | ପିକଅପ୍ ଲୋକେସନ୍ *
`ambulance.booking.purposeSectionTitle` | Purpose of Ambulance * | एम्बुलेंस का उद्देश्य * | ଆମ୍ବୁଲାନ୍ସର ଉଦ୍ଦେଶ୍ୟ *
`ambulance.booking.searchResultsSection` | 📍 Search Results | 📍 खोज परिणाम | 📍 ଖୋଜ ଫଳାଫଳ
`ambulance.booking.title` | Ambulance Details | एम्बुलेंस विवरण | ଆମ୍ବୁଲାନ୍ସ ବିବରଣୀ
`ambulance.booking.urgentBanner` | 🚨 EMERGENCY MODE — Priority dispatch activated | 🚨 इमरजेंसी मोड — प्राथमिकता के आधार पर भेजा जा रहा है | 🚨 ଜରୁରୀକାଳୀନ ମୋଡ୍ — ପ୍ରାଥମିକତାରେ ପଠାଯାଉଛି
`ambulance.freeInfo.autoAssignNote` | The nearest available NGO ambulance will be automatically assigned... | आपके अनुरोध के लिए सबसे नज़दीकी उपलब्ध NGO एम्बुलेंस अपने आप असाइन की जाएगी... | ଆପଣଙ୍କ ଅନୁରୋଧ ପାଇଁ ନିକଟସ୍ଥ ଉପଲବ୍ଧ NGO ଆମ୍ବୁଲାନ୍ସ ସ୍ୱୟଂଚାଳିତ ଭାବରେ ନିଯୁକ୍ତ ହେବ...
`ambulance.freeInfo.collapsedInfo` | ↑ Free Ambulance Info | ↑ फ्री एम्बुलेंस जानकारी | ↑ ମାଗଣା ଆମ୍ବୁଲାନ୍ସ ସୂଚନା
`ambulance.freeInfo.hospitalDistance` | 📍 {{km}} km away · {{area}} | 📍 {{km}} किमी दूर · {{area}} | 📍 {{km}} କିମି ଦୂର · {{area}}
`ambulance.freeInfo.nearbyHospitalsRef` | 🏥 Nearby Hospitals (for reference) | 🏥 आस-पास के अस्पताल (सिर्फ जानकारी के लिए) | 🏥 ନିକଟସ୍ଥ ଡାକ୍ତରଖାନା (କେବଳ ସୂଚନା ପାଇଁ)
`ambulance.freeInfo.ngoAreaLabel` | Area: {{area}} | क्षेत्र: {{area}} | ଅଞ୍ଚଳ: {{area}}
`ambulance.freeInfo.ngoCoverageLabel` | Coverage: {{areas}} | कवरेज: {{areas}} | କଭରେଜ୍: {{areas}}
`ambulance.freeInfo.ngoVehicleCount_one/_other` | 🚑 {{count}} vehicle(s) available | 🚑 {{count}} गाड़ी/गाड़ियां उपलब्ध | 🚑 {{count}} ଗାଡ଼ି ଉପଲବ୍ଧ (Odia doesn't inflect)
`ambulance.freeInfo.noNgoPartners` | No NGO partners found in your area. Service is still available via 108. | आपके क्षेत्र में कोई NGO साझेदार नहीं मिला। सेवा अभी भी 108 के ज़रिए उपलब्ध है। | ଆପଣଙ୍କ ଅଞ୍ଚଳରେ କୌଣସି NGO ସହଭାଗୀ ମିଳିଲା ନାହିଁ। ସେବା ତଥାପି 108 ମାଧ୍ୟମରେ ଉପଲବ୍ଧ।
`ambulance.freeInfo.ourRegisteredPartners` | Our Registered Partners | हमारे पंजीकृत साझेदार | ଆମର ପଞ୍ଜୀକୃତ ସହଭାଗୀ
`ambulance.freeInfo.purposeLine(WithSubType)` | Purpose: {{purpose}} [· {{subtype}}] | उद्देश्य: {{purpose}} [· {{subtype}}] | ଉଦ୍ଦେଶ୍ୟ: {{purpose}} [· {{subtype}}]
`ambulance.freeInfo.referenceNote` | These hospitals are shown for reference only... | ये अस्पताल सिर्फ जानकारी के लिए दिखाए गए हैं... | ଏହି ଡାକ୍ତରଖାନାଗୁଡ଼ିକ କେବଳ ସୂଚନା ପାଇଁ ଦେଖାଯାଇଛି...
`ambulance.freeInfo.requestBtnEmergency` | 🚨 Emergency Free Request | 🚨 इमरजेंसी फ्री रिक्वेस्ट | 🚨 ଜରୁରୀକାଳୀନ ମାଗଣା ରିକୱେଷ୍ଟ
`ambulance.freeInfo.requestBtnNormal` | Request Free Ambulance 🚑 | फ्री एम्बुलेंस के लिए रिक्वेस्ट करें 🚑 | ମାଗଣା ଆମ୍ବୁଲାନ୍ସ ପାଇଁ ରିକୱେଷ୍ଟ କରନ୍ତୁ 🚑
`ambulance.freeInfo.subtitle` | NGO / Sewa Organisation | NGO / सेवा संस्था | NGO / ସେବା ସଂସ୍ଥା
`ambulance.freeInfo.title` | Free Ambulance Service | फ्री एम्बुलेंस सेवा | ମାଗଣା ଆମ୍ବୁଲାନ୍ସ ସେବା
`ambulance.freeInfo.zeroBannerSub` | bogie charges nothing. This is a completely free service provided by registered NGOs. | bogie कोई शुल्क नहीं लेता... | bogie କୌଣସି ଚାର୍ଜ ନିଏ ନାହିଁ...
`ambulance.freeInfo.zeroBannerTitle` | Zero Commission — 100% Free Service | ज़ीरो कमीशन — 100% मुफ्त सेवा | ଜିରୋ କମିଶନ୍ — 100% ମାଗଣା ସେବା
`ambulance.index.*` | (Book an Ambulance screen — title, badges, zero-commission banner, disclaimer) | see or.json/hi.json | see or.json/hi.json
`ambulance.purposes.dead_body` | Dead Body Transfer | शव परिवहन | ମୃତଦେହ ପରିବହନ
`ambulance.purposes.dead_body_sub` | Respectful transfer of deceased | शव का सम्मानजनक परिवहन | ମୃତଦେହର ସମ୍ମାନଜନକ ପରିବହନ
`ambulance.purposes.emergency(_sub)` | Emergency / Immediate medical response needed | इमरजेंसी / तुरंत मेडिकल सहायता चाहिए | ଜରୁରୀକାଳୀନ / ତୁରନ୍ତ ମେଡିକାଲ୍ ସାହାଯ୍ୟ ଆବଶ୍ୟକ
`ambulance.purposes.patient_transfer(_sub)` | Patient Transfer / Shifting patient between hospitals or home | मरीज़ ट्रांसफर / मरीज़ को अस्पतालों के बीच या घर से ले जाना | ରୋଗୀ ସ୍ଥାନାନ୍ତର / ରୋଗୀଙ୍କୁ ଡାକ୍ତରଖାନା ମଧ୍ୟରେ କିମ୍ବା ଘରୁ ନେବା
`ambulance.review.btn.*` | Request Free / EMERGENCY REQUEST / Book {{hospital}} | फ्री एम्बुलेंस रिक्वेस्ट / इमरजेंसी रिक्वेस्ट / {{hospital}} बुक करें | ମାଗଣା ଆମ୍ବୁଲାନ୍ସ ରିକୱେଷ୍ଟ / ଜରୁରୀକାଳୀନ ରିକୱେଷ୍ଟ / {{hospital}} ବୁକ୍ କରନ୍ତୁ
`ambulance.review.charges.*` | Commission, ₹0 (Zero Commission), Government/NGO, ✅ Covered, FREE | कमीशन, ₹0 (ज़ीरो कमीशन), सरकार/NGO, ✅ कवर्ड, फ्री | କମିଶନ୍, ₹0 (ଜିରୋ କମିଶନ୍), ସରକାର/NGO, ✅ କଭର୍ଡ୍, ମାଗଣା
`ambulance.review.emergencyBannerText` | 🚨 This is an emergency booking... | 🚨 यह एक इमरजेंसी बुकिंग है... | 🚨 ଏହା ଏକ ଜରୁରୀକାଳୀନ ବୁକିଂ...
`ambulance.review.freeDisclaimer` | ⚠️ Free ambulance availability depends on government/NGO resources... | ⚠️ फ्री एम्बुलेंस की उपलब्धता... | ⚠️ ମାଗଣା ଆମ୍ବୁଲାନ୍ସ ଉପଲବ୍ଧତା...
`ambulance.review.paymentNote` | 💡 Payment is made directly to {{hospital}}... | 💡 पेमेंट सीधे {{hospital}} को की जाती है... | 💡 ପେମେଣ୍ଟ ସିଧାସଳଖ {{hospital}} କୁ କରାଯାଏ...
`ambulance.review.rules` (5-item array) | Arrival time, documentation, availability, call 108, zero commission | see or.json/hi.json | see or.json/hi.json
`ambulance.review.summary.*` | Type, Purpose, Amb. Type, Hospital, Pickup, Drop, Patient, Contact, Notes | प्रकार, उद्देश्य, एम्बु. प्रकार, अस्पताल, पिकअप, ड्रॉप, मरीज़, संपर्क, नोट्स | ପ୍ରକାର, ଉଦ୍ଦେଶ୍ୟ, ଆମ୍ବୁ. ପ୍ରକାର, ଡାକ୍ତରଖାନା, ପିକଅପ୍, ଡ୍ରପ୍, ରୋଗୀ, ଯୋଗାଯୋଗ, ନୋଟ୍ସ
`ambulance.review.toastFree/toastPaid` | Free ambulance requested!... / Ambulance booked at {{hospital}}!... | फ्री एम्बुलेंस रिक्वेस्ट हो गई!... / {{hospital}} पर एम्बुलेंस बुक हो गई!... | ମାଗଣା ଆମ୍ବୁଲାନ୍ସ ରିକୱେଷ୍ଟ ହେଲା!... / {{hospital}} ରେ ଆମ୍ବୁଲାନ୍ସ ବୁକ୍ ହେଲା!...
`ambulance.subTypes.bls/als` | Basic/Advanced Life Support (BLS/ALS) | बेसिक/एडवांस्ड लाइफ सपोर्ट (BLS/ALS) | ବେସିକ୍/ଏଡଭାନ୍ସଡ୍ ଲାଇଫ୍ ସପୋର୍ଟ (BLS/ALS)
`ambulance.subTypes.blsDesc/alsDesc` | Oxygen, paramedic, first aid / ICU on wheels, ventilator, doctor | ऑक्सीजन, पैरामेडिक, प्राथमिक उपचार / आईसीयू जैसी सुविधा, वेंटिलेटर, डॉक्टर | ଅମ୍ଳଜାନ, ପାରାମେଡିକ୍, ପ୍ରାଥମିକ ଚିକିତ୍ସା / ICU ପରି ସୁବିଧା, ଭେଣ୍ଟିଲେଟର୍, ଡାକ୍ତର
`ambulance.vehicles.equipment.*` (11 items) | Oxygen, First Aid, Stretcher, Paramedic, Ventilator, Defibrillator, ECG Monitor, IV Fluids, Doctor, Wheelchair, Attendant | see or.json/hi.json — flagged individually above for Defibrillator, IV Fluids, Oxygen | see or.json/hi.json
`ambulance.vehicles.meta.*.desc` | BLS/ALS/transport equipment descriptions | see or.json/hi.json | see or.json/hi.json
`ambulance.vehicles.noneTitle/noneSub` | No ambulances available / Please try again or call 108 | कोई एम्बुलेंस उपलब्ध नहीं है / कृपया दोबारा कोशिश करें या 108 पर कॉल करें | କୌଣସି ଆମ୍ବୁଲାନ୍ସ ଉପଲବ୍ଧ ନାହିଁ / ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ କିମ୍ବା 108 କୁ କଲ୍ କରନ୍ତୁ
`ambulance.vehicles.recommendedEmergency` / `suitablePatientTransfer` / `suitableRespectfulTransfer` | ⚡ Recommended for Emergency / ✓ Suitable for... | ⚡ इमरजेंसी के लिए अनुशंसित / ✓ ...के लिए उपयुक्त | ⚡ ଜରୁରୀକାଳୀନ ପାଇଁ ପରାମର୍ଶିତ / ✓ ...ପାଇଁ ଉପଯୁକ୍ତ
`ambulance.vehicles.rateNote` | ₹{{base}} base · ₹{{perKm}}/km · {{km}} km | ₹{{base}} बेस · ₹{{perKm}}/किमी · {{km}} किमी | ₹{{base}} ବେସ୍ · ₹{{perKm}}/କିମି · {{km}} କିମି

(Full untruncated strings, including the two long `deadBodyModal.body` / `ambulance.review.rules`
blocks, are in `or.json` / `hi.json` directly under the `ambulance` key — this table exists to
flag them for review, not to duplicate the full text.)

### Other Batch 2 items flagged for Odia review (non-emergency, lower priority)

- `truck.review` reuses `booking.rules.truck` (5-item array of driver/payment/legal rules) —
  standard risk-disclosure language, want a fluency check on the whole block.
- `cab.rentals.duration_one`/`_other` — Odia doesn't inflect "hour" for plural the way Hindi
  does; using the same string for both forms (`{{count}} ଘଣ୍ଟା`). Confirm this reads naturally
  for both "1 ଘଣ୍ଟା" and "5 ଘଣ୍ଟା" rather than needing a different construction.
- `booking.session.expiredTitle` / `couldNotIdentify` — normalized two slightly different
  English variants ("Session expired" vs "Session Expired") into one canonical string per
  language since case doesn't carry meaning in Hindi/Odia; flagging in case the reviewer
  expects the original two-variant distinction preserved for some reason.

## Batch 3 — tracking/*, support/*, profile/wallet, profile/safety

### ⚠️ Both Hindi AND Odia flagged for `tracking.*` and `profile.safety.*`

Per this batch's instructions, mid-ride status copy and SOS/emergency copy are the same class
of risk as ambulance content — a misread status mid-ride, or a misread emergency instruction,
is a different class of bug than a misread UI label. So unlike earlier batches (where Hindi
was generally treated as higher-confidence and not flagged), **every** `tracking.*` and
`profile.safety.*` string in *both* hi.json and or.json is listed below regardless of
confidence. `support.*` and `profile.wallet.*` follow the normal (Odia-only-if-uncertain) rule
and are not included in this table.

Specific items worth a closer look during native review:

- `tracking.cancelDialog.scheduledMsg` / `home.upcoming.cancelAlert.message` — these are the
  same English sentence reused across two screens (home's upcoming-ride cancel and tracking's
  in-ride cancel for a still-scheduled booking). Confirmed both hi/or translations are
  identical strings for consistency — check that reads naturally in both contexts.
- `profile.safety.sosInfoText` — the longest single string in this batch, a 3-clause
  instructional sentence about what the SOS button does. Given it's read in a moment of
  potential distress, prioritize clarity over eloquence — flag if the Hindi/Odia sentence
  structure makes any clause easy to misread as belonging to the wrong action (call vs. share
  location vs. alert support).
- `tracking.status.*` — these are the terse status-card headlines a rider glances at
  repeatedly during a ride (e.g. "Driver has arrived" / "Share your OTP to start the trip").
  Precision matters more than natural phrasing here; double-check none of the seven status
  pairs could be confused with an adjacent status (e.g. `accepted` vs `arriving`).
- `tracking.callDriverMsg` — "Call {{name}} at {{phone}}?" — confirm the Hindi/Odia word
  order still reads as a yes/no confirmation prompt and not a statement.
- `profile.safety.beforeRide` / `duringRide` / `afterRide` — three checklists (4, 4, 3 items).
  Each item was translated as a plain imperative instruction; flagging the full set for a
  fluency pass since they're read as a scannable list, not prose.

Full table (English source → Hindi → Odia) for every `tracking.*` and `profile.safety.*` key:

| Key | English | Hindi | Odia |
|---|---|---|---|
| `profile.safety.afterRide` | Rate your driver honestly,Report any issues immediately,Lost something? Contact driver via Help → Lost Item | अपने ड्राइवर को ईमानदारी से रेट करें,कोई भी समस्या हो तो तुरंत रिपोर्ट करें,कुछ खो गया? Help → Lost Item के ज़रिए ड्राइवर से संपर्क करें | ଆପଣଙ୍କର ଡ୍ରାଇଭରଙ୍କୁ ସାଧୁତାର ସହିତ ରେଟ୍ କରନ୍ତୁ,କୌଣସି ସମସ୍ୟା ହେଲେ ତୁରନ୍ତ ରିପୋର୍ଟ କରନ୍ତୁ,କିଛି ହଜିଗଲା? Help → Lost Item ମାଧ୍ୟମରେ ଡ୍ରାଇଭରଙ୍କ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ |
| `profile.safety.afterRideHeader` | AFTER YOUR RIDE | राइड के बाद | ରାଇଡ୍ ପରେ |
| `profile.safety.beforeRide` | Verify driver name and vehicle number before getting in,Share your trip with trusted contacts (Share button on tracking screen),Sit in the back seat when possible,Keep your phone charged | बैठने से पहले ड्राइवर का नाम और वाहन नंबर जांचें,अपनी ट्रिप भरोसेमंद कॉन्टैक्ट्स के साथ शेयर करें (ट्रैकिंग स्क्रीन पर शेयर बटन),जब संभव हो, पिछली सीट पर बैठें,अपना फ़ोन चार्ज रखें | ବସିବା ପୂର୍ବରୁ ଡ୍ରାଇଭରଙ୍କ ନାମ ଏବଂ ଗାଡ଼ି ନମ୍ବର ଯାଞ୍ଚ କରନ୍ତୁ,ଆପଣଙ୍କର ଯାତ୍ରା ବିଶ୍ୱସ୍ତ କଣ୍ଟାକ୍ଟଙ୍କ ସହିତ ସେୟାର୍ କରନ୍ତୁ (ଟ୍ରାକିଂ ସ୍କ୍ରିନ୍ ରେ ସେୟାର୍ ବଟନ୍),ସମ୍ଭବ ହେଲେ ପଛ ସିଟ୍ ରେ ବସନ୍ତୁ,ଆପଣଙ୍କର ଫୋନ୍ ଚାର୍ଜ ରଖନ୍ତୁ |
| `profile.safety.beforeRideHeader` | BEFORE YOUR RIDE | राइड से पहले | ରାଇଡ୍ ପୂର୍ବରୁ |
| `profile.safety.bogieSupport` | bogie Support | bogie सपोर्ट | bogie ସପୋର୍ଟ |
| `profile.safety.contactHint` | When you use Share Live Location in an SOS, we'll offer to send it straight to this contact via SMS. | जब आप SOS में Share Live Location इस्तेमाल करेंगे, हम इसे सीधे इस कॉन्टैक्ट को SMS से भेजने का विकल्प देंगे। | ଯେତେବେଳେ ଆପଣ SOS ରେ Share Live Location ବ୍ୟବହାର କରିବେ, ଆମେ ଏହାକୁ ସିଧାସଳଖ ଏହି କଣ୍ଟାକ୍ଟକୁ SMS ମାଧ୍ୟମରେ ପଠାଇବାର ବିକଳ୍ପ ଦେବୁ। |
| `profile.safety.contactNameLabel` | Name | नाम | ନାମ |
| `profile.safety.contactNamePlaceholder` | e.g. Mom, Rahul | जैसे Mom, Rahul | ଯେମିତି Mom, Rahul |
| `profile.safety.contactPhoneLabel` | Phone number | फ़ोन नंबर | ଫୋନ୍ ନମ୍ବର |
| `profile.safety.contactPhonePlaceholder` | 10-digit mobile number | 10-अंकों का मोबाइल नंबर | 10-ଅଙ୍କ ମୋବାଇଲ୍ ନମ୍ବର |
| `profile.safety.duringRide` | Track your route on the app,If route seems wrong, ask driver politely,Call driver from within the app — avoid sharing personal number,Share live location with family | ऐप पर अपना रूट देखते रहें,अगर रूट गलत लगे, तो ड्राइवर से विनम्रता से पूछें,ड्राइवर को ऐप के अंदर से कॉल करें — अपना निजी नंबर शेयर करने से बचें,परिवार के साथ लाइव लोकेशन शेयर करें | ଆପ୍ ରେ ଆପଣଙ୍କର ରୁଟ୍ ଦେଖନ୍ତୁ,ରୁଟ୍ ଭୁଲ୍ ଲାଗୁଥିଲେ, ଡ୍ରାଇଭରଙ୍କୁ ଶାଳୀନତା ସହିତ ପଚାରନ୍ତୁ,ଡ୍ରାଇଭରଙ୍କୁ ଆପ୍ ମାଧ୍ୟମରେ କଲ୍ କରନ୍ତୁ — ନିଜର ବ୍ୟକ୍ତିଗତ ନମ୍ବର ସେୟାର୍ କରିବାରୁ ବିରତ ରୁହନ୍ତୁ,ପରିବାର ସହିତ ଲାଇଭ୍ ଲୋକେସନ୍ ସେୟାର୍ କରନ୍ତୁ |
| `profile.safety.duringRideHeader` | DURING YOUR RIDE | राइड के दौरान | ରାଇଡ୍ ସମୟରେ |
| `profile.safety.emergencyContactHeader` | EMERGENCY CONTACT | इमरजेंसी कॉन्टैक्ट | ଜରୁରୀକାଳୀନ କଣ୍ଟାକ୍ଟ |
| `profile.safety.emergencyNumbersHeader` | EMERGENCY NUMBERS | इमरजेंसी नंबर | ଜରୁରୀକାଳୀନ ନମ୍ବର |
| `profile.safety.emergencySosHeader` | EMERGENCY SOS | इमरजेंसी SOS | ଜରୁରୀକାଳୀନ SOS |
| `profile.safety.invalidPhone` | Enter a valid phone number | एक मान्य फ़ोन नंबर दर्ज करें | ଏକ ବୈଧ ଫୋନ୍ ନମ୍ବର ଦିଅନ୍ତୁ |
| `profile.safety.numbers.childHelpline` | Child Helpline | चाइल्ड हेल्पलाइन | ଶିଶୁ ହେଲ୍ପଲାଇନ୍ |
| `profile.safety.numbers.police` | Police | पुलिस | ପୋଲିସ୍ |
| `profile.safety.numbers.womenHelpline` | Women Helpline | महिला हेल्पलाइन | ମହିଳା ହେଲ୍ପଲାଇନ୍ |
| `profile.safety.remove` | Remove | हटाएं | ହଟାନ୍ତୁ |
| `profile.safety.saveErrorMsg` | Could not save. Please try again. | सेव नहीं हो सका। दोबारा कोशिश करें। | ସେଭ୍ ହୋଇପାରିଲା ନାହିଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ। |
| `profile.safety.savedMsg` | Your emergency contact will be offered when you share your live location. | जब आप अपनी लाइव लोकेशन शेयर करेंगे, आपका इमरजेंसी कॉन्टैक्ट सुझाया जाएगा। | ଯେତେବେଳେ ଆପଣ ଆପଣଙ୍କର ଲାଇଭ୍ ଲୋକେସନ୍ ସେୟାର୍ କରିବେ, ଆପଣଙ୍କର ଜରୁରୀକାଳୀନ କଣ୍ଟାକ୍ଟ ପରାମର୍ଶ ଦିଆଯିବ। |
| `profile.safety.savedTitle` | Saved | सेव हो गया | ସେଭ୍ ହୋଇଗଲା |
| `profile.safety.sosBannerSub` | Emergency help is always one tap away during any bogie trip. | किसी भी bogie राइड के दौरान इमरजेंसी सहायता एक टैप दूर है। | ଯେକୌଣସି bogie ଯାତ୍ରା ସମୟରେ ଜରୁରୀକାଳୀନ ସାହାଯ୍ୟ ସର୍ବଦା ଏକ ଟାପ୍ ଦୂରରେ ଅଛି। |
| `profile.safety.sosBannerTitle` | Your Safety is Our Priority | आपकी सुरक्षा हमारी प्राथमिकता है | ଆପଣଙ୍କର ସୁରକ୍ଷା ଆମର ପ୍ରାଥମିକତା |
| `profile.safety.sosInfoText` | During a ride, tap the red SOS button on the tracking screen. Away from a ride, use the button above. Either way you can call 112 directly, share your live location, or alert bogie support in one tap. | राइड के दौरान, ट्रैकिंग स्क्रीन पर लाल SOS बटन दबाएं। राइड से बाहर, ऊपर दिया गया बटन इस्तेमाल करें। दोनों ही स्थिति में आप सीधे 112 पर कॉल कर सकते हैं, अपनी लाइव लोकेशन शेयर कर सकते हैं, या एक टैप में bogie सपोर्ट को सूचित कर सकते हैं। | ରାଇଡ୍ ସମୟରେ, ଟ୍ରାକିଂ ସ୍କ୍ରିନ୍ ରେ ଲାଲ୍ SOS ବଟନ୍ ଟାପ୍ କରନ୍ତୁ। ରାଇଡ୍ ବାହାରେ, ଉପରେ ଥିବା ବଟନ୍ ବ୍ୟବହାର କରନ୍ତୁ। ଉଭୟ ପ୍ରକାରେ ଆପଣ ସିଧାସଳଖ 112 କୁ କଲ୍ କରିପାରିବେ, ଆପଣଙ୍କର ଲାଇଭ୍ ଲୋକେସନ୍ ସେୟାର୍ କରିପାରିବେ, କିମ୍ବା ଏକ ଟାପ୍ ରେ bogie ସପୋର୍ଟକୁ ସୂଚିତ କରିପାରିବେ। |
| `profile.safety.title` | Safety | सुरक्षा | ସୁରକ୍ଷା |
| `profile.safety.update` | Update | अपडेट करें | ଅପଡେଟ୍ କରନ୍ତୁ |
| `tracking.ambulanceInfo.callHospital` | 📞 Call | 📞 कॉल करें | 📞 କଲ୍ କରନ୍ତୁ |
| `tracking.ambulanceInfo.emergency` | 🚨 EMERGENCY — Priority Response | 🚨 इमरजेंसी — प्राथमिकता रिस्पॉन्स | 🚨 ଜରୁରୀକାଳୀନ — ପ୍ରାଥମିକତା ରେସପନ୍ସ |
| `tracking.ambulanceInfo.freeNoCharge` | 🆓 Free Ambulance — No charges apply | 🆓 फ्री एम्बुलेंस — कोई शुल्क नहीं | 🆓 ମାଗଣା ଆମ୍ବୁଲାନ୍ସ — କୌଣସି ଚାର୍ଜ ନାହିଁ |
| `tracking.ambulanceInfo.hospitalLabel` | Hospital | अस्पताल | ଡାକ୍ତରଖାନା |
| `tracking.ambulanceInfo.zeroCommission` | 🏥 Zero Commission Service | 🏥 ज़ीरो कमीशन सेवा | 🏥 ଜିରୋ କମିଶନ୍ ସେବା |
| `tracking.bookingNotFound` | Booking not found | बुकिंग नहीं मिली | ବୁକିଂ ମିଳିଲା ନାହିଁ |
| `tracking.call` | Call | कॉल करें | କଲ୍ କରନ୍ତୁ |
| `tracking.callDriverFallback` | driver | ड्राइवर | ଡ୍ରାଇଭର |
| `tracking.callDriverMsg` | Call {{name}} at {{phone}}? | {{phone}} पर {{name}} को कॉल करें? | {{phone}} ରେ {{name}} ଙ୍କୁ କଲ୍ କରିବେ? |
| `tracking.callDriverTitle` | Call Driver | ड्राइवर को कॉल करें | ଡ୍ରାଇଭରଙ୍କୁ କଲ୍ କରନ୍ତୁ |
| `tracking.cancelDialog.ambulanceMsg` | Ambulance rides are always free to cancel — no charges apply. Cancel this booking? | एम्बुलेंस राइड रद्द करना हमेशा मुफ़्त है — कोई शुल्क नहीं लगता। यह बुकिंग रद्द करें? | ଆମ୍ବୁଲାନ୍ସ ରାଇଡ୍ ବାତିଲ୍ କରିବା ସର୍ବଦା ମାଗଣା — କୌଣସି ଚାର୍ଜ ଲାଗେ ନାହିଁ। ଏହି ବୁକିଂ ବାତିଲ୍ କରିବେ? |
| `tracking.cancelDialog.defaultMsg` | Are you sure you want to cancel? | क्या आप वाकई रद्द करना चाहते हैं? | ଆପଣ ନିଶ୍ଚିତ କି ବାତିଲ୍ କରିବାକୁ ଚାହାଁନ୍ତି? |
| `tracking.cancelDialog.feeCancelBtn` | Cancel — ₹{{fee}} | रद्द करें — ₹{{fee}} | ବାତିଲ୍ କରନ୍ତୁ — ₹{{fee}} |
| `tracking.cancelDialog.feeMsg` | Cancelling now will add a ₹{{fee}} cancellation fee to your next ride. Cancel anyway? | अभी रद्द करने पर आपकी अगली राइड में ₹{{fee}} की कैंसिलेशन फीस जुड़ेगी। फिर भी रद्द करें? | ଏବେ ବାତିଲ୍ କରିଲେ ଆପଣଙ୍କର ପରବର୍ତ୍ତୀ ରାଇଡ୍ ରେ ₹{{fee}} କାନ୍ସିଲେସନ୍ ଫି ଯୋଡ଼ାଯିବ। ତଥାପି ବାତିଲ୍ କରିବେ? |
| `tracking.cancelDialog.feeTitle` | Cancellation Fee Applies | कैंसिलेशन फीस लागू होगी | କାନ୍ସିଲେସନ୍ ଫି ଲାଗୁ ହେବ |
| `tracking.cancelDialog.freeWindowMsg` | Cancel this ride? No charges — you're within the free window. | इस राइड को रद्द करें? कोई शुल्क नहीं — आप फ्री विंडो के अंदर हैं। | ଏହି ରାଇଡ୍ ବାତିଲ୍ କରିବେ? କୌଣସି ଚାର୍ଜ ନାହିଁ — ଆପଣ ମାଗଣା ସମୟ ମଧ୍ୟରେ ଅଛନ୍ତି। |
| `tracking.cancelDialog.keepRide` | Keep Ride | राइड रखें | ରାଇଡ୍ ରଖନ୍ତୁ |
| `tracking.cancelDialog.scheduledMsg` | This ride hasn't been dispatched yet — cancelling is free. Cancel this scheduled ride? | यह राइड अभी डिस्पैच नहीं हुई है — रद्द करना मुफ़्त है। इस शेड्यूल राइड को रद्द करें? | ଏହି ରାଇଡ୍ ଏପର୍ଯ୍ୟନ୍ତ ଡିସ୍ପାଚ୍ ହୋଇନାହିଁ — ବାତିଲ୍ କରିବା ମାଗଣା। ଏହି ଶିଡ୍ୟୁଲ୍ ରାଇଡ୍ ବାତିଲ୍ କରିବେ? |
| `tracking.cancelDialog.title` | Cancel Ride | राइड रद्द करें | ରାଇଡ୍ ବାତିଲ୍ କରନ୍ତୁ |
| `tracking.cancelDialog.yesCancel` | Yes, Cancel | हां, रद्द करें | ହଁ, ବାତିଲ୍ କରନ୍ତୁ |
| `tracking.cancelRideBtn` | Cancel Ride | राइड रद्द करें | ରାଇଡ୍ ବାତିଲ୍ କରନ୍ତୁ |
| `tracking.cancellationFeeNotice` | A ₹{{fee}} cancellation fee will be added to your next ride. | आपकी अगली राइड में ₹{{fee}} की कैंसिलेशन फीस जोड़ी जाएगी। | ଆପଣଙ୍କର ପରବର୍ତ୍ତୀ ରାଇଡ୍ ରେ ₹{{fee}} କାନ୍ସିଲେସନ୍ ଫି ଯୋଡ଼ାଯିବ। |
| `tracking.chat.chatOpensLater` | Chat opens once your driver is on the way. | ड्राइवर के रास्ते में आने पर चैट खुलेगी। | ଡ୍ରାଇଭର ରାସ୍ତାରେ ଆସିଲେ ଚାଟ୍ ଖୁଲିବ। |
| `tracking.chat.chatUnavailable` | Chat unavailable | चैट उपलब्ध नहीं है | ଚାଟ୍ ଉପଲବ୍ଧ ନାହିଁ |
| `tracking.chat.disabledBarText` | 💬 Chat is available once your driver is on the way | 💬 ड्राइवर के रास्ते में आने पर चैट उपलब्ध होगी | 💬 ଡ୍ରାଇଭର ରାସ୍ତାରେ ଆସିଲେ ଚାଟ୍ ଉପଲବ୍ଧ ହେବ |
| `tracking.chat.driverFallback` | Driver | ड्राइवर | ଡ୍ରାଇଭର |
| `tracking.chat.inputPlaceholder` | Type a message... | मैसेज टाइप करें... | ମେସେଜ୍ ଟାଇପ୍ କରନ୍ତୁ... |
| `tracking.chat.quickReplies` | I'm waiting outside,Please call me,On my way down | मैं बाहर इंतज़ार कर रहा/रही हूं,कृपया मुझे कॉल करें,नीचे आ रहा/रही हूं | ମୁଁ ବାହାରେ ଅପେକ୍ଷା କରୁଛି,ଦୟାକରି ମୋତେ କଲ୍ କରନ୍ତୁ,ମୁଁ ତଳକୁ ଆସୁଛି |
| `tracking.chat.rideInProgress` | Ride in progress | राइड जारी है | ରାଇଡ୍ ଚାଲିଛି |
| `tracking.chat.sendMessagePrompt` | Send a message to your driver. | अपने ड्राइवर को मैसेज भेजें। | ଆପଣଙ୍କର ଡ୍ରାଇଭରଙ୍କୁ ଏକ ମେସେଜ୍ ପଠାନ୍ତୁ। |
| `tracking.collapseHint` | ▼  Collapse | ▼  छोटा करें | ▼  ଛୋଟ କରନ୍ତୁ |
| `tracking.completion.commentPlaceholder` | Leave a comment (optional) | कमेंट लिखें (वैकल्पिक) | ଏକ ମନ୍ତବ୍ୟ ଲେଖନ୍ତୁ (ଇଚ୍ଛାଧୀନ) |
| `tracking.completion.driver` | Driver | ड्राइवर | ଡ୍ରାଇଭର |
| `tracking.completion.duration` | Duration | अवधि | ଅବଧି |
| `tracking.completion.durationMin` | {{count}} min | {{count}} मिनट | {{count}} ମିନିଟ୍ |
| `tracking.completion.farePaid` | Fare Paid | चुकाया गया किराया | ଦିଆଯାଇଥିବା ଭଡ଼ା |
| `tracking.completion.howWasTrip` | How was your trip? | आपकी ट्रिप कैसी रही? | ଆପଣଙ୍କର ଯାତ୍ରା କେମିତି ଥିଲା? |
| `tracking.completion.skip` | Skip | छोड़ें | ଛାଡ଼ନ୍ତୁ |
| `tracking.completion.sub` | Thanks for riding with bogie | bogie के साथ राइड करने के लिए धन्यवाद | bogie ସହିତ ଯାତ୍ରା କରିଥିବାରୁ ଧନ୍ୟବାଦ |
| `tracking.completion.submitGoHome` | Submit & Go Home | सबमिट करें और होम जाएं | ଦାଖଲ କରନ୍ତୁ ଏବଂ ହୋମ୍ କୁ ଯାଆନ୍ତୁ |
| `tracking.completion.title` | Trip Completed! | ट्रिप पूरी हुई! | ଯାତ୍ରା ସମାପ୍ତ ହେଲା! |
| `tracking.distToDriver` | Driver {{dist}} | ड्राइवर {{dist}} | ଡ୍ରାଇଭର {{dist}} |
| `tracking.distToDrop` | Drop {{dist}} | ड्रॉप {{dist}} | ଡ୍ରପ୍ {{dist}} |
| `tracking.distanceLabel` | Distance | दूरी | ଦୂରତା |
| `tracking.driverFallback` | Your driver | आपका ड्राइवर | ଆପଣଙ୍କର ଡ୍ରାଇଭର |
| `tracking.expandHint` | ▲  Route details | ▲  रूट विवरण | ▲  ରୁଟ୍ ବିବରଣୀ |
| `tracking.failedToLoad` | Failed to load booking | बुकिंग लोड नहीं हो सकी | ବୁକିଂ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ |
| `tracking.fareEstimateTitle` | Fare estimate | किराया अनुमान | ଭଡ଼ା ଆକଳନ |
| `tracking.fareEstimated` | Estimated fare | अनुमानित किराया | ଆକଳିତ ଭଡ଼ା |
| `tracking.farePaid` | Fare paid | किराया चुकाया | ଦିଆଯାଇଥିବା ଭଡ଼ା |
| `tracking.goHome` | Go Home | होम पर जाएं | ହୋମ୍ କୁ ଯାଆନ୍ତୁ |
| `tracking.loading` | Loading your trip... | आपकी ट्रिप लोड हो रही है... | ଆପଣଙ୍କର ଯାତ୍ରା ଲୋଡ୍ ହେଉଛି... |
| `tracking.nearbyDrivers_one` | 🚗 {{count}} driver nearby | 🚗 {{count}} ड्राइवर पास में | 🚗 {{count}} ଡ୍ରାଇଭର ପାଖରେ |
| `tracking.nearbyDrivers_other` | 🚗 {{count}} drivers nearby | 🚗 {{count}} ड्राइवर पास में | 🚗 {{count}} ଡ୍ରାଇଭର ପାଖରେ |
| `tracking.nearbyLooking` | Looking for available drivers... | उपलब्ध ड्राइवर ढूंढे जा रहे हैं... | ଉପଲବ୍ଧ ଡ୍ରାଇଭର ଖୋଜାଯାଉଛି... |
| `tracking.otpShareLabel` | Share with driver | ड्राइवर के साथ शेयर करें | ଡ୍ରାଇଭରଙ୍କ ସହିତ ସେୟାର୍ କରନ୍ତୁ |
| `tracking.otpSub` | Driver needs this to start your ride | आपकी राइड शुरू करने के लिए ड्राइवर को यह चाहिए | ଆପଣଙ୍କର ରାଇଡ୍ ଆରମ୍ଭ କରିବାକୁ ଡ୍ରାଇଭରଙ୍କୁ ଏହା ଆବଶ୍ୟକ |
| `tracking.rate.error` | Could not submit rating. | रेटिंग सबमिट नहीं हो सकी। | ରେଟିଂ ଦାଖଲ ହୋଇପାରିଲା ନାହିଁ। |
| `tracking.rate.selectStars` | Please select at least 1 star | कम से कम 1 स्टार चुनें | ଅତିକମରେ 1 ଷ୍ଟାର୍ ବାଛନ୍ତୁ |
| `tracking.rate.title` | Rate driver | ड्राइवर को रेट करें | ଡ୍ରାଇଭରଙ୍କୁ ରେଟ୍ କରନ୍ତୁ |
| `tracking.restorePillPrefix` | ↑ {{title}} | ↑ {{title}} | ↑ {{title}} |
| `tracking.scheduledFindDriverSub` | We'll find your driver ~15 minutes before pickup | पिकअप से ~15 मिनट पहले हम आपके लिए ड्राइवर ढूंढेंगे | ପିକଅପ୍ ପୂର୍ବରୁ ~15 ମିନିଟ୍ ଆମେ ଆପଣଙ୍କ ପାଇଁ ଡ୍ରାଇଭର ଖୋଜିବୁ |
| `tracking.scheduledPickupLabel` | 🗓 Pickup scheduled for | 🗓 पिकअप शेड्यूल है | 🗓 ପିକଅପ୍ ଶିଡ୍ୟୁଲ୍ ହୋଇଛି |
| `tracking.status.accepted.sub` | Your driver is heading to you | आपका ड्राइवर आपकी तरफ आ रहा है | ଆପଣଙ୍କର ଡ୍ରାଇଭର ଆପଣଙ୍କ ଆଡ଼କୁ ଆସୁଛନ୍ତି |
| `tracking.status.accepted.title` | Driver on the way | ड्राइवर आ रहा है | ଡ୍ରାଇଭର ଆସୁଛନ୍ତି |
| `tracking.status.arriving.sub` | Share your OTP to start the trip | ट्रिप शुरू करने के लिए अपना OTP बताएं | ଯାତ୍ରା ଆରମ୍ଭ କରିବାକୁ ଆପଣଙ୍କର OTP ଦିଅନ୍ତୁ |
| `tracking.status.arriving.title` | Driver has arrived | ड्राइवर पहुंच गया है | ଡ୍ରାଇଭର ପହଞ୍ଚିଗଲେ |
| `tracking.status.cancelled.sub` | This trip was cancelled | यह ट्रिप रद्द कर दी गई थी | ଏହି ଯାତ୍ରା ବାତିଲ୍ ହୋଇଥିଲା |
| `tracking.status.cancelled.title` | Booking cancelled | बुकिंग रद्द हुई | ବୁକିଂ ବାତିଲ୍ ହେଲା |
| `tracking.status.completed.sub` | Thanks for riding with bogie | bogie के साथ राइड करने के लिए धन्यवाद | bogie ସହିତ ଯାତ୍ରା କରିଥିବାରୁ ଧନ୍ୟବାଦ |
| `tracking.status.completed.title` | Trip completed | ट्रिप पूरी हुई | ଯାତ୍ରା ସମାପ୍ତ ହେଲା |
| `tracking.status.in_progress.sub` | Heading to your destination | आपके गंतव्य की ओर जा रहे हैं | ଆପଣଙ୍କର ଗନ୍ତବ୍ୟସ୍ଥାନ ଆଡ଼କୁ ଯାଉଛି |
| `tracking.status.in_progress.title` | On the way | राइड जारी है | ରାଇଡ୍ ଚାଲିଛି |
| `tracking.status.scheduled.sub` | We'll find your driver closer to pickup time | पिकअप समय के करीब हम आपके लिए ड्राइवर ढूंढेंगे | ପିକଅପ୍ ସମୟ ପାଖେଇ ଆସିଲେ ଆମେ ଆପଣଙ୍କ ପାଇଁ ଡ୍ରାଇଭର ଖୋଜିବୁ |
| `tracking.status.scheduled.title` | Ride scheduled | राइड शेड्यूल हो गई | ରାଇଡ୍ ଶିଡ୍ୟୁଲ୍ ହେଲା |
| `tracking.status.searching.sub` | Matching you with nearby drivers | आपको पास के ड्राइवरों से मिलाया जा रहा है | ଆପଣଙ୍କୁ ନିକଟସ୍ଥ ଡ୍ରାଇଭରଙ୍କ ସହିତ ମେଳ କରାଯାଉଛି |
| `tracking.status.searching.title` | Finding a driver... | ड्राइवर ढूंढा जा रहा है... | ଡ୍ରାଇଭର ଖୋଜାଯାଉଛି... |
| `tracking.tripFare` | Trip fare | ट्रिप किराया | ଯାତ୍ରା ଭଡ଼ା |
| `tracking.vehicleFallback` | Vehicle | वाहन | ଗାଡ଼ି |
| `tracking.viewMyRides` | View My Rides | मेरी राइड्स देखें | ମୋର ରାଇଡ୍ସ ଦେଖନ୍ତୁ |

## Batch 4 — profile long tail + legal (final user-app batch)

Screens: `profile/legal.tsx` (index), `profile/legal/{terms,privacy,cookies,community,licenses}.tsx`,
`profile/promos.tsx`, `profile/refer.tsx`, `profile/family.tsx`, `profile/addresses.tsx`,
`profile/inbox.tsx`, `profile/help.tsx`, `profile/drive.tsx`, `profile/settings.tsx` (leftover
strings from Phase 1), `referral.tsx`, `+not-found.tsx`.

`referral.tsx` and `+not-found.tsx` render no UI text (silent redirect screens) — nothing to extract.

### Legal screens — body text intentionally left English

Per product decision: `profile/legal/*.tsx` are legal/policy documents. Only screen chrome was
extracted and translated — page titles (`profile.legal.items.*`), the footer copyright line
(`profile.legal.copyright` / `copyrightMultiline`), and the "Effective/Updated" date-label
sentences (`profile.legal.privacy.datesLabel`, `profile.legal.terms.datesLabel`). All body prose —
section headers, bullet lists, paragraphs — remains hardcoded English pending professional legal
translation. None of this content is fetched from the backend; it is hardcoded in each screen
file. Approximate word counts (English body content, chrome/footer excluded) for scoping that
future translation pass:

| File | Approx. word count | Content type |
|---|---|---|
| `profile/legal/privacy.tsx` | ~700 | Privacy Policy — 13 numbered sections (DPDP Act 2023 rights, data retention, grievance officer, etc.) |
| `profile/legal/terms.tsx` | ~630 | Terms of Service — acceptance, services, eligibility, booking/cancellation, payments, conduct, ambulance/truck-specific terms, liability, governing law |
| `profile/legal/community.tsx` | ~480 | Community Guidelines — rider/truck/ambulance conduct rules, ratings policy, violations |
| `profile/legal/cookies.tsx` | ~350 | Cookie Policy — essential/analytics storage, no-ad-tracking statement |
| `profile/legal/licenses.tsx` | ~290 | Open-source license attributions (mostly proper nouns/library names + standard license-type labels, not prose — lowest translation priority of the five) |

(Word counts are a rough heuristic — counted from source string literals >15 chars, so may include
a small amount of double-counted metadata. Good enough for scoping, not for a translation quote.)

### Glossary reuse — no drift introduced this batch

Batch 4 strings reused existing glossary terms throughout: राइड/ରାଇଡ୍ (ride), पेमेंट/ପେମେଣ୍ଟ
(payment), ड्राइवर/ଡ୍ରାଇଭର୍ (driver), बुकिंग/ବୁକିଂ (booking), रद्द करें/ବାତିଲ୍ କରନ୍ତୁ (cancel),
पिकअप/ପିକଅପ୍ (pickup), ड्रॉप/ଡ୍ରପ୍ (drop), वाहन·गाड़ी/ଗାଡ଼ି (vehicle), कन्फर्म करें/କନ୍ଫର୍ମ କରନ୍ତୁ
(confirm), अकाउंट/ଆକାଉଣ୍ଟ (account), इमरजेंसी/ଜରୁରୀକାଳୀନ (emergency), सेव की गई जगह/ସେଭ୍
କରାଯାଇଥିବା ସ୍ଥାନ (saved place — `profile.addresses`). Oxygen kept as ऑक्सीजन (Hindi, transliteration)
/ ଅମ୍ଳଜାନ (Odia, formal register) in the new `profile.help.sections.ambulance` FAQ item, matching
the Batch 2 ambulance-vehicle-equipment choice exactly.

### Ambulance-adjacent content flagged (both hi and or)

`profile.help.sections.ambulance.*` (2 FAQ items — "Is the free ambulance really free?" and "What
is included in a paid BLS ambulance?") is flagged in full below, consistent with the Batch 2/3 rule
that all ambulance-related translations get reviewed regardless of confidence, even when the
screen itself (Help & Support) isn't an ambulance-flow screen.

Key | English | Hindi | Odia
---|---|---|---
`profile.help.sections.ambulance.title` | AMBULANCE | एम्बुलेंस | ଆମ୍ବୁଲାନ୍ସ
`profile.help.sections.ambulance.items[0].q` | Is the free ambulance really free? | क्या फ्री एम्बुलेंस सच में मुफ्त है? | ମାଗଣା ଆମ୍ବୁଲାନ୍ସ ପ୍ରକୃତରେ ମାଗଣା କି?
`profile.help.sections.ambulance.items[0].a` | Yes — it is government/NGO sponsored. Subject to availability. Response time is not guaranteed. For life-threatening emergencies, always call 108 first. | हां — यह सरकार/NGO द्वारा प्रायोजित है। उपलब्धता पर निर्भर है। पहुंचने का समय तय नहीं है। जानलेवा इमरजेंसी में हमेशा सबसे पहले 108 पर कॉल करें। | ହଁ — ଏହା ସରକାର/NGO ପ୍ରାୟୋଜିତ। ଉପଲବ୍ଧତା ଉପରେ ନିର୍ଭରଶୀଳ। ପହଞ୍ଚିବା ସମୟ ନିଶ୍ଚିତ ନୁହେଁ। ଜୀବନ ବିପଦଜନକ ଜରୁରୀକାଳୀନ ସ୍ଥିତିରେ ସର୍ବଦା ପ୍ରଥମେ 108 କୁ କଲ୍ କରନ୍ତୁ।
`profile.help.sections.ambulance.items[1].q` | What is included in a paid BLS ambulance? | पेड BLS एम्बुलेंस में क्या शामिल है? | ଦେୟ BLS ଆମ୍ବୁଲାନ୍ସରେ କଣ ଅନ୍ତର୍ଭୁକ୍ତ?
`profile.help.sections.ambulance.items[1].a` | Trained paramedic, oxygen cylinder, first aid kit, stretcher, and basic patient monitoring equipment. | ट्रेंड पैरामेडिक, ऑक्सीजन सिलेंडर, फर्स्ट एड किट, स्ट्रेचर, और बेसिक पेशेंट मॉनिटरिंग उपकरण। | ପ୍ରଶିକ୍ଷିତ ପାରାମେଡିକ୍, ଅମ୍ଳଜାନ ସିଲିଣ୍ଡର, ପ୍ରାଥମିକ ଚିକିତ୍ସା କିଟ୍, ଷ୍ଟ୍ରେଚର୍, ଏବଂ ମୌଳିକ ରୋଗୀ ମନିଟରିଂ ଉପକରଣ।

No other Batch 4 content met the Odia-review-list bar (none of it is safety/emergency/tracking
critical in the way Batches 2–3 flagged); everything else was translated with normal confidence
using established glossary terms.
