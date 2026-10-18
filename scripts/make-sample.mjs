// Writes public/bengaluru-rent-agreement.pdf: a made-up 11-month agreement in the style
// Bengaluru brokers print on stamp paper, with the usual traps left in on purpose,
// and public/bengaluru-rent-agreement-draft.pdf: the fairer draft that was "agreed on WhatsApp".
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

// what the draft said before the printed copy changed it
const DRAFT = [
  ["Rs. 3,20,000/- (Rupees Three Lakh Twenty Thousand", "Rs. 1,92,000/- (Rupees One Lakh Ninety Two Thousand"],
  ["The Owner may terminate this tenancy by giving 1 (one) month notice to the Tenant.", "The Owner may terminate this tenancy by giving 2 (two) months notice to the Tenant."],
  ["8. PAINTING AND CLEANING: At the time of vacating, a sum equal to one month rent, that is Rs. 32,000/-,", "8. PAINTING AND CLEANING: At the time of vacating, the actual cost of painting, as per bills, shall"],
  ["shall be deducted from the security deposit towards painting and cleaning charges, irrespective of", "be deducted from the security deposit only if the walls are damaged beyond normal wear and tear,"],
  ["the condition of the premises.", "subject to a maximum of Rs. 10,000/-."],
  ["60 (sixty) days after the Tenant hands over vacant possession of the premises and the keys.", "15 (fifteen) days after the Tenant hands over vacant possession of the premises and the keys."],
];

async function write(file, sheets) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Rental Agreement (sample)");
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  sheets.forEach((lines, i) => {
    const page = pdf.addPage([595, 842]);
    let y = 780;
    for (const line of lines) {
      const heading = /^[A-Z ]{6,}$/.test(line) || /^\d+\. [A-Z -]+:/.test(line);
      const size = i === 0 && y === 780 ? 16 : 10.5;
      page.drawText(line, { x: 56, y, size, font: heading ? bold : font, color: rgb(0.1, 0.1, 0.1) });
      y -= line ? 17 : 10;
    }
    page.drawText(`Page ${i + 1} of ${sheets.length}`, { x: 268, y: 40, size: 9, font });
  });

  await writeFile(file, await pdf.save());
  console.log(`wrote ${file}`);
}

const draft = pages.map((lines) => lines.map((line) => DRAFT.reduce((l, [now, was]) => l.replace(now, was), line)));
await mkdir("public", { recursive: true });
await write("public/bengaluru-rent-agreement.pdf", pages);
await write("public/bengaluru-rent-agreement-draft.pdf", draft);

// An offer letter with the usual fresher traps: a bond, a clawback, 90 days' notice, a non-compete.
const offer = [
  [
    "NORTHWIND TECHSOFT PRIVATE LIMITED",
    "Ref: NTS/HR/2026/1187                                          Date: 05-10-2026",
    "",
    "OFFER OF EMPLOYMENT",
    "",
    "Dear Mr. Rahul Shetty,",
    "We are pleased to offer you the position of Associate Software Engineer at our Bengaluru office.",
    "Your date of joining will be 02-11-2026.",
    "",
    "1. COMPENSATION: Your total Cost to Company (CTC) will be Rs. 6,50,000/- per annum. Of this, the fixed",
    "salary is Rs. 4,80,000/- per annum and the variable pay is Rs. 1,20,000/- per annum, payable at the",
    "sole discretion of the Company based on individual and Company performance. The balance consists of",
    "employer contribution to provident fund, gratuity and insurance.",
    "",
    "2. JOINING BONUS: You will receive a one-time joining bonus of Rs. 50,000/-, which shall be repayable in",
    "full if you leave the Company for any reason within 12 (twelve) months of joining.",
    "",
    "3. SERVICE AGREEMENT: You will undergo training at the Company's cost. You agree to serve the Company",
    "for a minimum of 24 (twenty four) months. If you leave before completing 24 months, you shall pay the",
    "Company Rs. 2,00,000/- towards training cost recovery as liquidated damages.",
    "",
    "4. PROBATION: You will be on probation for 6 (six) months, during which either party may end the",
    "employment with 30 days notice.",
  ],
  [
    "5. NOTICE PERIOD: After confirmation, you shall give 90 (ninety) days notice in writing to resign.",
    "The Company may, at its discretion, accept payment of basic salary in lieu of notice.",
    "",
    "6. TERMINATION: The Company may terminate your employment at any time by giving 30 days notice or",
    "salary in lieu thereof, without assigning any reason.",
    "",
    "7. NON-COMPETE: For a period of 12 (twelve) months after you leave the Company, you shall not join",
    "or work for any client or competitor of the Company, directly or indirectly.",
    "",
    "8. LOCATION: Your initial place of posting is Bengaluru. You may be transferred to any location or",
    "office of the Company or its clients in India or abroad, as per business needs.",
    "",
    "9. LEAVE: You are entitled to 18 (eighteen) days of paid leave per calendar year.",
    "",
    "Please sign and return a copy of this letter as your acceptance.",
    "",
    "For Northwind Techsoft Private Limited",
    "(Head - Human Resources)",
    "",
    "SAMPLE DOCUMENT. The company, person and every figure in this letter are invented for testing.",
  ],
];

// A small personal loan quoted at a "flat" rate, with the charges that come with it.
const loan = [
  [
    "LOAN AGREEMENT AND KEY FACT STATEMENT",
    "",
    "Lender: Sample Finance Limited (a made-up NBFC)                     Agreement No: SFL/PL/26/04471",
    "Borrower: Ms. Kavya Nair, Bengaluru",
    "",
    "1. LOAN AMOUNT: The Lender agrees to lend and the Borrower agrees to borrow a sum of Rs. 1,00,000/-",
    "(Rupees One Lakh only).",
    "",
    "2. INTEREST: Interest shall be charged at the rate of 14% per annum on a flat basis on the loan amount.",
    "",
    "3. TENURE AND EMI: The loan shall be repaid in 12 (twelve) equated monthly instalments of Rs. 9,500/-",
    "each, starting from 05-12-2026.",
    "",
    "4. CHARGES DEDUCTED AT DISBURSAL: A processing fee of Rs. 3,000/- plus GST and a credit life insurance",
    "premium of Rs. 2,400/- shall be deducted from the loan amount at the time of disbursal.",
    "",
    "5. FORECLOSURE: The Borrower may foreclose the loan after 6 EMIs on payment of a foreclosure charge of",
    "5% of the principal outstanding.",
    "",
    "6. LATE PAYMENT: A late payment charge of Rs. 750/- per instalment shall apply, and penal interest at",
    "36% per annum shall be charged on the overdue amount.",
    "",
    "7. BOUNCE: Each dishonour of NACH mandate or cheque shall attract a bounce charge of Rs. 590/-.",
    "",
    "8. RECOVERY: In the event of default, the Lender or its authorised recovery agents may contact the",
    "Borrower's references, relatives and employer, and take such steps as it deems fit to recover dues.",
    "",
    "SAMPLE DOCUMENT. The lender, borrower and every figure here are invented for testing.",
  ],
];

await write("public/sample-offer-letter.pdf", offer);
await write("public/sample-loan-agreement.pdf", loan);
