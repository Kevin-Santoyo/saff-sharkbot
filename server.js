import tmi from 'tmi.js';
import extraLifeAPI from 'extra-life-api';
import fetch from "node-fetch"
import 'dotenv/config'

const participantID = process.env.PARTICIPANT_ID;
const botAccountName = process.env.BOT_NAME
const OAuthToken = process.env.OAUTH_TOKEN
const BaseServerURL = process.env.API_SERVER

const client = new tmi.Client({
    connection: {
        secure: true,
        reconnect: true
    },
    identity: {
        username: botAccountName,
        password: OAuthToken
    },
    channels: [ 'sharkimsandfriends']
});
let donationEtag = ''
let incentivesEtag = ''
const authorizedUsers = ['sharkimsandfriends', 'kevshallperish', 'volcanicdiva', 'woodrow', 'timtriestwitch', 'myke', 'yelah']
const personNames = (await getSwearCount()).data

client.connect();
let incentives
getIncentivesBlob();
let donationCount = 0
setInterval(getDonations, 15000)

client.on('message', (channel, tags, message, self) => {
    const username = tags['display-name'].toLowerCase()

    if (!(authorizedUsers.find(e => e === username))) return
    if(self || !message.startsWith('!')) return

    const args = message.slice(1).split(' ')
    const command = args.shift().toLowerCase()

    console.log(args,' | Arguments')
    if (command === 'swear') {
        const name = args[0]
        if (name) {
            const userID = streamerNameSearch(name)
            const isUpdated = updateSwearCount(userID)
            if (isUpdated) {
                client.say(channel, `${name}'s swear count has been updated`)
            } else client.say(channel, 'There was an error updating the swear count')
        } else return
    }

    if (command === 'setswear') {
        if (args[0] && args[1]) {
            const name = args[0].toLowerCase()
            if (isNaN(args[1])) {
                client.say(channel, 'Invalid input')
                return
            }
            const count = args[1]
            const userID = streamerNameSearch(name)

            console.log(userID)
            if (userID) {
                const isUpdated = setSwearCount(userID, count)
                if (isUpdated) {
                    client.say(channel, `${name}'s swear count has been set to ${count}`)
                } else client.say(channel, 'There was an error updating the swear count')
            } else {
                client.say(channel, 'Incorrect name. Use !swearnames to see a list of valid inputs.')
                return
            }
        } else return
    }

    if (command === 'swearnames') {
        let swearnames = ''
        for (let i = 0; i < personNames.length; i++) {
            let tempName = personNames[i].attributes.name
            if (i === personNames.length - 1) {
                swearnames += 'and ' + tempName
            } else {
                swearnames += tempName + ', '
            }
        }
        client.say(channel, `Valid inputs are ${swearnames}`)
    }
});



function streamerNameSearch(name) {
    let userID = ''
    for (let i = 0; i < personNames.length; i++) {
        if (name === personNames[i].attributes.name.toLowerCase()) {
            userID = personNames[i].id
            return userID
        }
    }
    return false
}

async function getDonations() {
    const response = await fetch('https://extralife.donordrive.com/api/participants/' + participantID + '/donations', {
        method: 'GET',
        headers: {
            'If-None-Match': donationEtag
        }})
    const data = await response;

    const receivedDonationEtag = data.headers.get('etag')
    if (receivedDonationEtag) donationEtag = receivedDonationEtag.substring(2)
    console.log(donationEtag, 'donation ETAG')
    if (response.status === 200) {
        response.json().then(data => {
            data = data[0]
            const donor = data.displayName
            const amount = data.amount
            let incentive = ''
            if (data.incentiveID) incentive = data.incentiveID
            if (donationCount === 0) {
                console.log('Initial data start')
                donationCount++
                return
            }
            if (incentive !== '') {
                incentives.forEach(incent => {
                    if (incentive = incent.incentiveID) {
                        incentive = incent.description
                        client.say('sharkimsandfriends', `${donor} donated $${amount} and claimed ${incentive}`)
                    }
                });
                return
            } else client.say('kevshallperish', `${donor} donated $${amount}`)
            console.log('donation received')
        })
    } else if (response.status === 304) {
        console.log('No new data received')
        return
    }
}

async function getIncentivesBlob() {
    const response = await fetch('https://extralife.donordrive.com/api/participants/' + participantID + '/incentives', {
        method: 'GET',
        headers: {
            'If-None-Match': incentivesEtag
        }})
    const data = await response;

    const receivedIncentivesEtag = data.headers.get('etag')
    if (receivedIncentivesEtag) incentivesEtag = receivedIncentivesEtag.substring(2)
    console.log(incentivesEtag, 'incentive ETAG')

    if (response.status === 200) {
        response.json().then(data => {
            incentives = data
        })
    } else if (response.status === 304) {
        return
    }
}

async function getSwearCount() {
    const response = await fetch(BaseServerURL + 'api/swears', {
        method: 'GET'
    })
    if (!response.ok) return null
    return response.json()
    
}

async function setSwearCount(userID, count) {
    const reponseBody = {
        "data" : {
            count: count
        }
    }
    const response = await fetch(BaseServerURL + 'api/swears/' + userID, {
        method: 'PUT',
        body: JSON.stringify(reponseBody),
        headers: { 'Content-Type': 'application/json' }
    })

    if (response.ok) {
        return true
    } else {
        return false
    }
}

async function updateSwearCount(userID) {
    const response = (await getSwearCount()).data
    let newCount
    for (let i = 0; i < response.length; i++) {
        if (userID === response[i].id) {
            newCount = response[i].attributes.count + 1
            break
        }
    }

    const reponseBody = {
        "data": {
            count: newCount
        }
    }
    const response2 = await fetch(BaseServerURL + 'api/swears/' + userID, {
        method: 'PUT',
        body: JSON.stringify(reponseBody),
        headers: { 'Content-Type': 'application/json' }
    })

    if (response2.ok) {
        return true
    } else {
        return false
    }
}
