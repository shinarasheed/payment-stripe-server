const dotenv = require("dotenv");
const express = require("express");
const Stripe = require("stripe");
const braintree = require("braintree");

const app = express();
const port = 5000;

dotenv.config();

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.MERCHANT_ID,
  publicKey: process.env.PUBLIC_KEY,
  privateKey: process.env.PRIVATE_KEY,
});

const stripe = Stripe(process.env.SECRET_KEY, { apiVersion: "2020-08-27" });

app.listen(port, () => {
  console.log(`app listening at ${port}`);
});

app.use(express.json());

app.post("/create-payment-intent", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1099, //lowest denomination of particular currency
      currency: "usd",
      payment_method_types: ["card"], //by default
    });

    const clientSecret = paymentIntent.client_secret;

    res.json({
      clientSecret: clientSecret,
    });
  } catch (e) {
    console.log(e.message);
    res.json({ error: e.message });
  }
});

app.post("/payment-sheet", async (req, res) => {
  // Use an existing Customer ID if this is a returning customer.
  const { totalPrice } = req.query;
  const customer = await stripe.customers.create();
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: "2020-08-27" }
  );
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalPrice,
    currency: "usd",
    customer: customer.id,
  });
  res.json({
    paymentIntent: paymentIntent.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customer: customer.id,
  });
});

// Braintree integration
app.get("/api/generate/token", (req, res) => {
  gateway.clientToken
    .generate({
      // customerId: aCustomerId,
    })
    .then((response) => {
      // const clientToken = response.clientToken;
      // res.status(200).send(clientToken);
      res.status(200).send(response);
    })
    .catch((err) => {
      res.status(500).send(err);
    });
});

app.post("/api/checkout", (req, res) => {
  const nonceFromTheClient = req.body.payment_method_nonce;
  const { amount } = req.body;
  gateway.transaction
    .sale({
      amount,
      paymentMethodNonce: nonceFromTheClient,
      // deviceData: deviceDataFromTheClient,
      options: {
        submitForSettlement: true,
      },
    })
    .then((response) => {
      res.status(200).send(response);
    })
    .catch((err) => {
      res.status(500).send(err);
    });
});
