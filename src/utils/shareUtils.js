import { supabase } from '../lib/supabaseClient';

/**
 * Uploads a PDF Blob to Supabase Storage bucket ('invoice-pdfs')
 * Returns the public URL if successful, or null on fallback/failure.
 */
export async function uploadPdfToStorage(pdfBlob, fileName) {
  if (!pdfBlob || !fileName) return null;

  try {
    const bucketName = 'invoice-pdfs';
    
    // Attempt upload with upsert option
    const { error: uploadErr } = await supabase.storage
      .from(bucketName)
      .upload(fileName, pdfBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf'
      });

    if (uploadErr) {
      console.warn('Supabase storage upload notice:', uploadErr.message);
      return null;
    }

    // Get public URL
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return data?.publicUrl || null;
  } catch (err) {
    console.warn('PDF storage upload exception:', err);
    return null;
  }
}

/**
 * Generates formatted text summary message for sharing.
 * Optional useCrLf parameter ensures line breaks use \r\n for mailto links (%0D%0A).
 */
export function buildShareMessage({ type = 'Invoice', number = '', date = '', amount = 0, buyerName = '', pdfUrl = null, useCrLf = false }) {
  const formattedAmount = parseFloat(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const docTypeLabel = type.toLowerCase().includes('quotation') ? 'Quotation' : 'Tax Invoice';
  const nameGreeting = buyerName ? `Hi ${buyerName},` : 'Hello,';
  const nl = useCrLf ? '\r\n' : '\n';
  
  let message = `${nameGreeting} please find your ${docTypeLabel} #${number} dated ${date} for ₹${formattedAmount}.`;

  if (pdfUrl) {
    message += `${nl}${nl}View/Download PDF: ${pdfUrl}`;
  } else {
    message += `${nl}${nl}(PDF attached separately)`;
  }

  message += `${nl}${nl}Thank you,${nl}Krishna Engineering`;

  return message;
}

/**
 * Opens WhatsApp Web/App with pre-filled message text.
 */
export function shareViaWhatsApp({ type = 'Invoice', number = '', date = '', amount = 0, buyerName = '', pdfUrl = null }) {
  const text = buildShareMessage({ type, number, date, amount, buyerName, pdfUrl, useCrLf: false });
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  console.log('Opening WhatsApp share URL:', whatsappUrl);
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Generates email details (subject, body, mailtoUrl).
 */
export function getEmailShareDetails({ type = 'Invoice', number = '', date = '', amount = 0, buyerName = '', buyerEmail = '', pdfUrl = null }) {
  const docTypeLabel = type.toLowerCase().includes('quotation') ? 'Quotation / Estimate' : 'Tax Invoice';
  const subject = `${docTypeLabel} ${number} from Krishna Engineering`;
  const body = buildShareMessage({ type, number, date, amount, buyerName, pdfUrl, useCrLf: true });
  
  const recipient = buyerEmail ? buyerEmail.trim() : '';
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const mailtoUrl = `mailto:${recipient ? encodeURIComponent(recipient) : ''}?subject=${encodedSubject}&body=${encodedBody}`;
  
  return { subject, body, recipient, mailtoUrl };
}

/**
 * Opens default Mail client with pre-filled Subject and Body.
 */
export function shareViaEmail({ type = 'Invoice', number = '', date = '', amount = 0, buyerName = '', buyerEmail = '', pdfUrl = null }) {
  const { mailtoUrl, subject } = getEmailShareDetails({ type, number, date, amount, buyerName, buyerEmail, pdfUrl });
  console.log('Triggering Email share via mailto URL:', mailtoUrl);
  window.location.href = mailtoUrl;
}
