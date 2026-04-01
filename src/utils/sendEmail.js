import ejs from "ejs";
import path from "path";
import { fileURLToPath } from "url";
import { transporter } from "../config/email.js";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sendEmail = async ({ to, subject, template, data, from }) => {
  try {
    // Path to templates folder
    const templatePath = path.join(__dirname, "../emails", `${template}.ejs`);

    // Render HTML from EJS
    const html = await ejs.renderFile(templatePath, data);

    // Mail options
    const mailOptions = {
      from: from || `"Gather & Deliver" <${process.env.EMAIL}>`,
      to,
      subject,
      html,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("SendEmail Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
};

export default sendEmail;
