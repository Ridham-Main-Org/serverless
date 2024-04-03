const functions = require('@google-cloud/functions-framework');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
// const crypto = require('crypto');
const Knex = require('knex');

const createTcpPool = async config => {

  const dbConfig = {
    client: 'pg',
    connection: {
        host:process.env.DB_HOST,
        port:process.env.DB_PORT,
        user:process.env.DB_USER,
        password:process.env.DB_PASSWORD,
        database:process.env.DB_NAME
    },
    ...config,
  };
  return Knex(dbConfig);
};


const mailgun = new Mailgun(formData);
const mg = mailgun.client({username: 'api', key:process.env.MAILGUN_API_KEY});

functions.cloudEvent('helloPubSub', async cloudEvent => {
  try {
        const base64email = cloudEvent.data.message.data;
        const email = JSON.parse(Buffer.from(base64email, 'base64').toString('utf-8')).username;
        console.log("email is",email);
        const knex = await createTcpPool();
        const hashedToken = await knex('users').select('id').where('username', email);
        console.log("hashedtoken",hashedToken);
        const expirationTimestamp = Date.now() + 2 * 60 * 1000; // 2 minutes from now
        console.log("expirationTimestamp is",expirationTimestamp);
        const verificationLink = `https://my-webapp.me/v1/user/verify?token=${hashedToken[0].id}`;

        await mg.messages.create('my-webapp.me', {
          from: 'Excited User <mailgun@my-webapp.me>',
          to: [email],
          subject: 'Verify Your Email Address!',
          text: `Click this link to verify your email: ${verificationLink}`,
          html: `<p>Click <a href="${verificationLink}"> ${verificationLink} </a> to verify your email address.</p>`,
        });

        await knex('users').where('username', email).update({ expiration_time: expirationTimestamp});
        console.log(`Verification email sent to ${email}`);
        await knex.destroy();

  } catch (error) {
        console.error('Error sending verification email:', error);
  }
});