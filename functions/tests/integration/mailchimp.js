const crypto = require("crypto");

const mailchimp = jest.requireActual("@mailchimp/mailchimp_marketing");

const apiKey = process.env.MAILCHIMP_API_KEY;
const apiKeyParts = apiKey.split("-");

if (apiKeyParts.length === 2) {
  const server = apiKeyParts.pop();
  mailchimp.setConfig({
    apiKey,
    server,
  });
} else {
  throw new Error("Unable to set Mailchimp configuration");
}

/**
 * MD5 hashes the email address, for use as the mailchimp identifier
 * @param {string} email
 * @returns {string} The MD5 Hash
 */
function subscriberHasher(email) { return crypto.createHash("md5").update(email.toLowerCase()).digest("hex"); }

exports.subscriberHasher = subscriberHasher;
exports.mailchimp = mailchimp;
