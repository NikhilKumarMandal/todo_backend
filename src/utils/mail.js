import nodemailer from "nodemailer";

const sendMail = async(options) => {

    

    const transporter = nodemailer.createTransport({
        host: process.env.MAILTRAP_SMTP_HOST,
        port: process.env.MAILTRAP_SMTP_PORT,
        auth: {
        user: process.env.MAILTRAP_SMTP_USER,
        pass: process.env.MAILTRAP_SMTP_PASS,
        },
    });


    const mail = {
        from: "nikhilkumarmandal946@gmail.com", 
        to: options.email, 
        subject: options.subject, 
        text: options.message,
    };

    try {
        await transporter.sendMail(mail);
    } catch (error) {
        console.log(
            "Email service failed silently. Make sure you have provided your MAILTRAP credentials in the .env file"
        );
        console.log("Error: ", error);
    }
    
} 




export { 
    sendMail,
}