import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use · BillDost',
  description: 'BillDost ke istemal ki shartein, aasan bhasha mein.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        <Link href="/signup" className="text-sm font-semibold text-primary hover:underline underline-offset-4">
          ← Wapas
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-6 mb-2">Terms of Use</h1>
        <p className="text-muted-foreground text-[15px] mb-10">
          BillDost istemal karne ki shartein, aasan shabdon mein. Last updated: November 2026.
        </p>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-bold text-lg mb-2">1. BillDost kya hai</h2>
            <p>
              BillDost ek billing software hai jisse aapki dukaan bills bana sakti hai, stock aur customers
              ka hisaab rakh sakti hai, aur bills WhatsApp par bhej sakti hai. BillDost ek tool hai; aapke
              bills, rates aur tax ki sahi jaankari bharna aapki zimmedari hai.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">2. Aapka account</h2>
            <p>
              Apna email aur password surakshit rakhna aapki zimmedari hai. Apne staff ko jo access aap dete
              hain, unke dwara kiye gaye kaam bhi aapke account ke hisaab mein aate hain. Galat ya kisi aur
              ki jaankari se account banana mana hai.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">3. Bills aur tax</h2>
            <p>
              BillDost GST ki calculation aapke diye gaye rates aur details ke hisaab se karta hai. Apne
              GSTIN, rates aur returns ki jaanch khud ya apne CA se karwana aapki zimmedari hai. BillDost
              kisi bhi galat filing ke liye zimmedar nahi hai.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">4. WhatsApp delivery</h2>
            <p>
              Bills WhatsApp ke official Cloud API ke through bheje jate hain. Delivery WhatsApp aur
              customer ke network par bhi nirbhar karti hai, isliye har message ke turant pahunchne ki
              guarantee nahi di ja sakti. Spam ya bina ijazat ke messages bhejna mana hai; aisa karne par
              WhatsApp aapka number band kar sakta hai.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">5. Plans aur payment</h2>
            <p>
              Paid plans ki keemat aur shartein kharid ke samay jo dikhayi jayengi wahi lagu hongi. Keemat
              badalne par aapko pehle se suchna di jayegi.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">6. Data aur band karna</h2>
            <p>
              Aapka data aapka hai. Aap kabhi bhi account band karne aur apna data delete karne ke liye keh
              sakte hain; iske liye Privacy Policy dekhein. In sharton ka gambhir ullanghan hone par BillDost
              account band kar sakta hai.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">7. Sampark</h2>
            <p>
              Kisi bhi sawaal ke liye billdost.in par diye gaye contact details par BillDost team se sampark
              karein.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
