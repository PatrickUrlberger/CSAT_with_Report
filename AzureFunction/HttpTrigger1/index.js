const jwt = require("jsonwebtoken");
const axios = require("axios");


const guestIssuer = {
    "userUniqueId": "AlexTest", // A unique ID for your user
    "userName": "AlexTest", // Display name, pick anything you'd like.
    "issuerId": "Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi83MTA0YjlhNC03MDhhLTQ5NTAtOTVmOS1mNmU1NWU0NGUzMjQ", // Use your Guest Issuer ID from your Guest app
    "issuerSecret":  "GJS+gEWb79TcY9aDRzIxkmd5oCrBjTtjbwQK33a3mC0=" // Use the Guest Issuer Shared Secret from your Guest app
};


module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');

    const name = (req.query.name || (req.body && req.body.name));
    const responseMessage = name
    let parsedParticipants = await parseParticipants(req.body.participants)
    
    context.res = {
        status: 200, /* Defaults to 200 */
        body: parsedParticipants
    };
}



async function createToken(){
    return new Promise(function(resolve,reject){
        jwt.sign(
            {
              "sub": guestIssuer.userUniqueId,
              "name": guestIssuer.userName,
              "iss": guestIssuer.issuerId
            },
            Buffer.from(guestIssuer.issuerSecret, 'base64'), // The shared secret from your Guest app
            function(err, token) {
                if(err){
                    reject(err);
                }
                let config = {
                    url: "https://webexapis.com/v1/jwt/login",
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
                axios(config)
                .then(response => {

                    resolve(response.data.token)
                })
                .catch(error => {
                    reject(error);
                })
            }
          );
    })
}


async function parseParticipants(callParticipants){
    let accessToken = await createToken();


    let parsedParticipants = await Promise.all(callParticipants.map(async participant => {
      try{

        if(participant.Email != ""){
          let webexUser = await getUser(participant.sparkUserId,accessToken);
          console.log(webexUser)
          participant.DisplayName = webexUser.displayName;
          participant.Email = webexUser.emails[0];
        }
        return Promise.resolve(participant)
        
      }
      catch(error){
        return Promise.resolve(participant)
      }
  
      })
    )
    return Promise.resolve(parsedParticipants);
}

async function getUser(sparkuserId,accessToken){
    try{
        let config = {
            method: "GET",
            url: `https://webexapis.com/v1/people?id=${sparkuserId}`,
            headers: {
                "Authorization": "Bearer " + accessToken
            }
        }
      let response = await axios(config);
      return Promise.resolve(response.data.items[0]);
    }
    catch(error){
      console.error(error)
      return Promise.reject(error);
    }
    
}