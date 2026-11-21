import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy · BillDost',
  description: 'BillDost aapka data kaise rakhta hai, aasan bhasha mein.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        <Link href="/signup" className="text-sm font-semibold text-primary hover:underline underline-offset-4">
          ← Wapas
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-6 mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-[15px] mb-10">
          Hum kaunsa data rakhte hain, kyun rakhte hain, aur aapke adhikaar. Last updated: November 2026.
        </p>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-bold text-lg mb-2">1. Hum kaunsa data rakhte hain</h2>
            <p>
              Aapki dukaan ki jaankari (naam, address, phone, GSTIN, UPI ID), aapke customers ke naam aur
              phone number jo aap bills mein bharte hain, aapke products aur stock ki details, aur aapke
              banaye gaye bills, quotations aur payments ka record. Ye data sirf isliye rakha jata hai taaki
              app aapke liye kaam kar sake.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">2. Data ka istemal</h2>
            <p>
              Data ka istemal sirf app ki seva dene ke liye hota hai: bills banana, WhatsApp par bhejna,
              reports aur hisaab dikhana. Hum aapka ya aapke customers ka data bechte nahi hain, aur na hi
              use vigyapan (advertising) ke liye istemal karte hain.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">3. WhatsApp delivery</h2>
            <p>
              Jab aap bill bhejte hain, customer ka phone number aur bill ki PDF WhatsApp ke official Cloud
              API (Meta) ke through jati hai, taaki message deliver ho sake. Is delivery par Meta ki apni
              privacy policy bhi lagu hoti hai.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">4. Data kahan rehta hai</h2>
            <p>
              Data surakshit cloud servers par encrypted connection ke through rakha jata hai. Har dukaan
              ka data alag rakha jata hai; ek dukaan ka staff dusri dukaan ka data nahi dekh sakta.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">5. Aapke adhikaar (DPDP Act)</h2>
            <p>
              Aapko apna data dekhne, galat data sudharne, aur apna data delete karwane ka adhikaar hai.
              Apne customers ke data ke liye aap data principal ke sampark ke jawabdar hain; koi customer
              apna data hatane ko kahe to aap app se use delete kar sakte hain, aur zarurat par hum aapki
              madad karenge.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">6. Sampark</h2>
            <p>
              Privacy se juda koi sawaal ho to billdost.in par diye gaye contact details par BillDost team
              se sampark karein. Hum uchit samay mein jawab denge.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
