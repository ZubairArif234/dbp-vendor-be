import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load env variables
dotenv.config({ path: "./src/config/config.env" });

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.APP_PASSWORD,
  },
});

// Verify transporter
transporter.verify((error, success) => {
  if (error) {
    console.error("Error with mail transporter config:", error);
  } else {
    console.log("Mail transporter is ready to send emails");
  }
});
