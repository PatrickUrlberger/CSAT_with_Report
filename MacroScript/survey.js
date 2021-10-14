import xapi from 'xapi';

const mailRecepients = ["stefan.slominski@sws.de"]
const reportEndpoint = "https://prod-234.westeurope.logic.azure.com:443/workflows/822ca63884cb48338ab2f3e0bad94a7c/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7wJGPlnIMAnExbh4y4vyo4zsBzJ2iO08KnmT1hUKKaQ"
const guestIssuerToken = "YmM3OTNhMmEtNjcwMy00YjFlLTkzMzQtOTFmZWU1N2MyNTc3MGUyZjcxOTMtNjQ1_PF84_7104b9a4-708a-4950-95f9-f6e55e44e324";

let myproblem = '';
let myemail = '';
let mycall = {};
let callParticipants = [];


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function resetCallParameters(){
  myproblem = '';
  myemail = '';
  mycall = {};
  callParticipants = [];
}

async function sendUserReport(userHappiness){

  try{
    let happy = userHappiness=="happy";

    let deviceName = await (xapi.Status.SystemUnit.ProductId.get());
    let software = await xapi.Status.SystemUnit.Software.DisplayName.get()

    mycall.deviceName = deviceName;
    mycall.software = software;

    let callInfo = Object.entries(mycall).map(entry => {
      return `${entry[0]}: ${entry[1]}`
    }).join("<br>");

    let parsedParticipants = await parseParticipants();

    console.log("reporting problem...");
    let json = {
      report: happy?"Der Benutzer hatte eine sehr gute Meeting Experience":myproblem,
      callParticipants: parsedParticipants,
      myemail: myemail,
      mailRecepients: mailRecepients,
      call: callInfo
    }
    
    console.log("json",json)
    //await xapi.Command.HttpClient.Post({Header: "Content-Type: application/json",Url: reportEndpoint},JSON.stringify(json))
    console.log("problem was supported sucessfully")
    resetCallParameters();
  }
  catch(error){
    console.error(error);
    resetCallParameters();
  }

}

async function parseParticipants(){
  let accessToken = await getIssuerToken();
  let parsedParticipants = [...callParticipants]
  parsedParticipants = await Promise.all(parsedParticipants.map(async participant => {
    try{
      if(parseParticipants.Email != ""){
        let webexUser = await getUser(participant.sparkuserId,accessToken);
        parseParticipants.DisplayName = webexUser.displayName;
        parseParticipants.Email = webexUser.emails[0];
      }
      return Promise.resolve(participant)
      
    }
    catch(error){
      return Promise.resolve(participant)
    }

    })
  )
  return Promise.resolve(parseParticipants);
}




xapi.Event.Conference.ParticipantList.on(async event => {
  if(!event.hasOwnProperty("ParticipantUpdated")){
    return
  }
  let update = event.ParticipantUpdated;
  let user = callParticipants.find(participant => {
    return participant.SparkUserId == update.SparkUserId;
  })
  if(!user){
    let eventUser = {
      DisplayName: update.DisplayName,
      SparkUserId: update.SparkUserId,
      isHost: update.isHost,
      Email: update.Email || "" 
    }
    callParticipants.push(eventUser)
  }
});



xapi.status.on('SystemUnit State NumberOfActiveCalls', (callCounter) => {
    if(callCounter == 1){
          xapi.command("UserInterface Message Alert Display", {
              Text: 'OK, es kann losgehen.                                      Wir wünschen ein großartiges Meeting :)'
              , Title: 'Meeting gestartet'
              , Duration:4
          }).catch((error) => { console.error(error); });
    }
});


xapi.event.on('CallDisconnect', (event) => {
  mycall = event
    if(event.Duration > 120){
        xapi.command("UserInterface Message Prompt Display", {
              Title: "Wie war Ihre Meeting Experience?"
            , Text: ''
            , FeedbackId: 'callrating'
            , 'Option.1':'Alles wunderbar!'
            , 'Option.2':'Es war OK'
            , 'Option.3': 'Das war nicht gut!'
          }).catch((error) => { console.error(error); });
    }
    /*else{
       xapi.command("UserInterface Message Prompt Display", {
              Title: "What went wrong?"
            , Text: 'Hm, no call. What happened?'
            , FeedbackId: 'nocallrating'
            , 'Option.1':'I dialled the wrong number!'
            , 'Option.2':"I don't know"
            , 'Option.3': 'oops, wrong button'
       }).catch((error) => { console.error(error); });
    }*/
});


xapi.event.on('UserInterface Message TextInput Response', (event) => {
    switch(event.FeedbackId){
        case 'feedback_step1':
                myproblem = event.Text;
                sleep(1000).then(() => {
                    xapi.command("UserInterface Message TextInput Display", {
                              Duration: 0
                            , FeedbackId: "feedback_step2"
                            , InputType: "SingleLine"
                            , KeyboardState: "Open"
                            , Placeholder: "eMail"
                            , SubmitText: "Next"
                            , Text: "Bitte geben Sie Ihre eMail Adresse an, wir melden uns schnellstmöglich bei Ihnen."
                            , Title: "Kontaktinformation"
                      }).catch((error) => { console.error(error); });
                });
              
              //console.log('Problem provided: ', myproblem);
              break;
        case 'feedback_step2':
            myemail = event.Text;

            sleep(500).then(() => {
                xapi.command("UserInterface Message Alert Display", {
                    Title: 'Feedback erhalten'
                    , Text: 'Vielen Dank für Ihre Unterstützung... Wir melden uns!'
                    , Duration: 3
                }).catch((error) => { console.error(error); });
            });
            sendUserReport("unhappy")
            console.log('Call provided: ', mycall);
            console.log('Problem provided: ', myproblem);
            console.log('eMail provided: ' , myemail);  
            myproblem = '';
            myemail = '';
            //mycall = '';
            break;
    }
});



xapi.event.on('UserInterface Message Prompt Response', (event) => {
    var displaytitle = '';
    var displaytext = '';
    switch(event.FeedbackId){
        case 'callrating':
            switch(event.OptionId){
                case '1':
                    displaytitle = 'Vielen Dank!';
                    displaytext = 'Wieder ein zufriedener Webex-User! :-D';
                    xapi.command("UserInterface Message Alert Display", {Title: displaytitle, Text: displaytext, Duration: 8});
                    myproblem = "Alles wunderbar!";
                    myemail = "N/A";
                    sendUserReport("happy");
                    myproblem = '';
                    myemail = '';
                    break;
                case '2':
                    displaytitle = ':-/';
                    displaytext = 'Ok! Wir versuchen, es beim nächsten Mal besser zu machen';
                    xapi.command("UserInterface Message Alert Display", {Title: displaytitle, Text: displaytext, Duration: 8});
                    break;
                case '3':
                    xapi.command("UserInterface Message TextInput Display", {
                              Duration: 0
                            , FeedbackId: "feedback_step1"
                            , InputType: "SingleLine"
                            , KeyboardState: "Open"
                            , Placeholder: "Problembeschreibung"
                            , SubmitText: "Weiter"
                            , Text: "Bitte sagen Sie uns, was nicht gut lief.                                       Ihr Feedback ist sehr wichtig für uns!"
                            , Title: "Das tut uns leid!"
                      }).catch((error) => { console.error(error); });
                    break;
                default:
                    displaytext = 'Hm, diese Antwort können wir nicht verarbeiten...';
            }
            break;
        /*case 'nocallrating':
            switch(event.OptionId){
                case '1':
                    displaytitle = ':-)';
                    displaytext = 'Ok, maybe we need to make larger buttons..';
                    break;
                case '2':
                    displaytitle = 'Oops';
                    displaytext = 'Ok, do you want to try to debug?';
                    break;
                case '3':
                    displaytitle = ':-(';
                    displaytext = 'Oops, maybe we need a simpler user interface';
                    break;

                default:
                    displaytext = 'Hm, that was an unhandled answer';
            }
            xapi.command("UserInterface Message Alert Display", {
                Title: displaytitle
                , Text: displaytext
                , Duration: 5
            }).catch((error) => { console.error(error); });
            */
    }
});



