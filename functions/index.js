const functions = require("firebase-functions");
const admin = require('firebase-admin')
require('dotenv').config()

admin.initializeApp()

const dbRef = admin.firestore().doc('tokens/demo')
const tokensRef = admin.firestore().doc('tokens')
const usersRef = admin.firestore().doc('tokens')

const TwitterApi = require('twitter-api-v2').default
const twitterClient = new TwitterApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET
})
const callbackURL = process.env.CALLBACK_URL
const SCOPE_RIGHTS = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']

// OpenAI API init
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
    organization: process.env.ORG,
    apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// STEP 1 - Auth URL
exports.auth = functions.https.onRequest( async (req, response) => {
    const {url, codeVerifier, state} = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        {scope: SCOPE_RIGHTS}
    )
    // store verifier
    await dbRef.set({codeVerifier, state});

    response.redirect(url);
});

// STEP 2 - Verify callback code, store access_token
exports.callback = functions.https.onRequest(async (request, response) => {
    const {state, code} = request.query;

    const dbSnapshot = await dbRef.get();
    const {codeVerifier, state: storedState} = dbSnapshot.data();

    if (state !== storedState) {
        return response.status(400).send('Stored tokens do not match!');
    }

    const {
        client: loggedClient,
        accessToken,
        refreshToken,
    } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackURL,
    });

    await dbRef.set({accessToken, refreshToken});

    const {data} = await loggedClient.v2.me(); // start using the client if you want

    response.send(data);
});

// STEP 3 - Refresh tokens and post tweets
exports.tweet = functions.https.onRequest(async (request, response) => {
    const {refreshToken} = (await dbRef.get()).data();

    const {
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({accessToken, refreshToken: newRefreshToken});

    let prompt = ""
    const randomInteger = Math.floor(Math.random() * 10);


    if (randomInteger%4 === 0) {
        console.log('Common Topics')
        prompt = commonTopics[(Math.random() * commonTopics.length) | 0]
    }else if (randomInteger%3 === 0) {
        console.log('Wildcards')
        prompt = wildCards[(Math.random() * wildCards.length) | 0]
    }else {
        console.log('Tweet something about crypto topics')
        const promptStart = "Tweet something "
        const randomAdjective = positiveAdjectives[(Math.random() * positiveAdjectives.length) | 0]
        const randomCryptoTopic = cryptoTopics[(Math.random() * cryptoTopics.length) | 0]
        prompt = `${promptStart}${randomAdjective} about ${randomCryptoTopic}`
    }
    console.log(prompt)

    const nextTweet = await openai.createCompletion('text-davinci-001', {
        prompt: prompt,
        max_tokens: 64,
    });

    const {data} = await refreshedClient.v2.tweet(
        nextTweet.data.choices[0].text
    );

    response.send(data);
});


const wildCards = [
    'use one hashtag',
    'use multiple hashtags',
    'mention a famous twitter user',
    'use a bunch of emojis',
    'ask people to follow my account',
    'say something inspiring',
    'talk about the joy of being a sentient being',
    'give credit to Elon Musk',
    'push a hyped cryptocurrency or memecoin',
    'say something about life realizations',
    'Incorporate a trending topic',
    'write an unhinged manifesto',
    'promulgate a conspiracy theory',
    'advocate for privacy in tech',
]

const commonTopics = [
    'tweet about cryptocurrency adoption',
    'tweet a famous quote',
    'post a tweet about science',
    'say something grateful',
]

const positiveAdjectives = [
    'cool',
    'awesome',
]

const cryptoTopics = [
    'Bitcoin',
    'Ethereum',
    'Ripple',
    'Cardano',
    'Dogecoin',
    'Luna',
    'Fantom',
    'DeFi',
    'Cryptocurrencies',
    'NFT',
    'Metaverse',
    'BNB',
    'Binance',
]


