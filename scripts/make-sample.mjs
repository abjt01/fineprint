// Writes sample/bengaluru-rent-agreement.pdf: a made-up 11-month agreement in the style
// Bengaluru brokers print on stamp paper, with the usual traps left in on purpose.
// Every name, address and number here is invented.
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const pages = [
  [
    "RENTAL AGREEMENT",
    "",
    "This Rental Agreement is made and executed at Bengaluru on this 1st day of November 2026",
    "BETWEEN",
    "Mr. K. Venkatesh Murthy, aged about 58 years, residing at No. 41, 9th Main, Jayanagar 4th Block,",
    "Bengaluru 560011, hereinafter called the OWNER (which expression shall include his heirs and assigns),",
    "AND",
    "Ms. Ananya Rao, aged about 26 years, working at a private company, hereinafter called the TENANT.",
    "",
    "WHEREAS the Owner is the absolute owner of the residential flat bearing No. 302, Third Floor,",
    "Sai Lakshmi Residency, 14th Cross, HSR Layout Sector 2, Bengaluru 560102 (the SCHEDULE PREMISES),",
    "and the Tenant has approached the Owner to take the same on rent for residential purpose only.",
    "",
    "NOW THIS AGREEMENT WITNESSETH AS FOLLOWS:",
    "",
    "1. PERIOD: The tenancy shall be for a period of 11 (eleven) months commencing from 01-11-2026",
    "and ending on 30-09-2027. It may be renewed by mutual consent on fresh terms.",
    "",
    "2. RENT: The Tenant shall pay a monthly rent of Rs. 32,000/- (Rupees Thirty Two Thousand only)",
    "on or before the 5th day of every English calendar month. A late fee of Rs. 500/- per day shall be",
    "charged for every day of delay beyond the 5th.",
    "",
    "3. MAINTENANCE: In addition to the rent, the Tenant shall pay the apartment maintenance charges of",
    "Rs. 3,500/- per month directly to the Sai Lakshmi Residency Owners Association.",
    "",
    "4. SECURITY DEPOSIT: The Tenant has paid a sum of Rs. 3,20,000/- (Rupees Three Lakh Twenty Thousand",
    "only) as interest free refundable security deposit, the receipt of which the Owner hereby acknowledges.",
  ],
  [
    "5. ENHANCEMENT: On renewal, the rent shall be enhanced by 10% (ten percent) over the last paid rent.",
    "",
    "6. LOCK-IN: Both parties agree to a lock-in period of 6 (six) months from the date of commencement.",
    "If the Tenant vacates before the lock-in period ends, the Tenant shall pay the rent for the",
    "remaining lock-in months, which the Owner may deduct from the security deposit.",
    "",
    "7. NOTICE: After the lock-in period, the Tenant shall give 2 (two) months notice in writing before",
    "vacating the premises. The Owner may terminate this tenancy by giving 1 (one) month notice to the Tenant.",
    "",
    "8. PAINTING AND CLEANING: At the time of vacating, a sum equal to one month rent, that is Rs. 32,000/-,",
    "shall be deducted from the security deposit towards painting and cleaning charges, irrespective of",
    "the condition of the premises.",
    "",
    "9. REFUND: The security deposit, after the above deductions, shall be refunded to the Tenant within",
    "60 (sixty) days after the Tenant hands over vacant possession of the premises and the keys.",
    "",
    "10. REPAIRS: All repairs to the premises, including plumbing, electrical, seepage and structural",
    "repairs, shall be carried out by the Tenant at the Tenant's own cost.",
    "",
    "11. ELECTRICITY AND WATER: The Tenant shall pay electricity charges at Rs. 12/- per unit as per",
    "the sub-meter installed by the Owner, and water charges of Rs. 800/- per month.",
  ],
  [
    "12. USE AND RESTRICTIONS: The premises shall be used for residential purpose only. The Tenant shall",
    "not keep pets of any kind. Cooking of non-vegetarian food is not permitted in the premises. Guests",
    "shall not stay for more than 2 (two) nights in a month without written permission of the Owner.",
    "",
    "13. SUBLETTING: The Tenant shall not sublet or part with the possession of the premises or any part",
    "of it to any other person.",
    "",
    "14. INSPECTION: The Owner or his agent may inspect the premises at any reasonable time.",
    "",
    "15. FITTINGS: The premises are let out with 3 fans, 6 tube lights, 2 geysers and one modular kitchen.",
    "Any damage to these fittings shall be made good by the Tenant.",
    "",
    "IN WITNESS WHEREOF the parties have signed this agreement on the day, month and year first above",
    "written, in the presence of the following witnesses.",
    "",
    "OWNER                                              TENANT",
    "(K. Venkatesh Murthy)                              (Ananya Rao)",
    "",
    "WITNESSES:",
    "1. S. Prakash, HSR Layout",
    "2. M. Divya, Koramangala",
    "",
    "SAMPLE DOCUMENT. Every name, address and amount in this agreement is invented for testing.",
  ],
];

const pdf = await PDFDocument.create();
pdf.setTitle("Rental Agreement (sample)");
const font = await pdf.embedFont(StandardFonts.TimesRoman);
const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

pages.forEach((lines, i) => {
  const page = pdf.addPage([595, 842]);
  let y = 780;
  for (const line of lines) {
    const heading = /^[A-Z ]{6,}$/.test(line) || /^\d+\. [A-Z -]+:/.test(line);
    const size = i === 0 && y === 780 ? 16 : 10.5;
    page.drawText(line, { x: 56, y, size, font: heading ? bold : font, color: rgb(0.1, 0.1, 0.1) });
    y -= line ? 17 : 10;
  }
  page.drawText(`Page ${i + 1} of ${pages.length}`, { x: 268, y: 40, size: 9, font });
});

await mkdir("sample", { recursive: true });
await writeFile("sample/bengaluru-rent-agreement.pdf", await pdf.save());
console.log("wrote sample/bengaluru-rent-agreement.pdf");
