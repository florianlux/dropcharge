export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    if (!process.env.RESEND_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing RESEND_API_KEY" })
      };
    }

    let payload = {};

    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON body" })
      };
    }

    const email = (payload.email || "").trim().toLowerCase();

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" })
      };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Welcome to DropCharge 🚀",
      html: "<p>Thanks for subscribing!</p>"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        id: response.id
      })
    };

  } catch (error) {
    console.error("newsletter_signup error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error.message
      })
    };
  }
}
