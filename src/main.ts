import * as puppeteer from 'puppeteer';
// Create an async closure, this way we can use await everywhere

async function send_message_to_user(li_at:string,url:URL,msg:string){
  // Create the browser instance. Pass an object to launch to configure the browser instance
  const browser = await puppeteer.launch({headless:false});
  const cookie = {
    name:'li_at',
    value: li_at,
    domain: '.linkedin.com'
  }
  // Create a new page, and navigate to the URL when it's ready
  const page = await browser.newPage()
  await page.goto(url.toString())

  // Set cookie after we're in linkedIn domain.
  await page.setCookie(cookie)

  // Enable request interception so we can capture csrf-token in one of the requests
  await page.setRequestInterception(true)
  // set csrf as null for now
  var csrf = null
  page.on("request", function(interceptedRequest:any){
    // If csrf-token in the request's header assign it to csrf variable
    if ('csrf-token' in interceptedRequest.headers()) {
      csrf = interceptedRequest.headers()['csrf-token']
    }
    interceptedRequest.continue()
  })

  // Wait till the network traffic is settled.
  await page.goto(url.toString(), {
    waitUntil: 'networkidle2',
  })

  // Log out csrf token
  console.log(csrf)

  // Get href of message button so we can decide if there is an already opened conservation or 
  // we should create a new one.
  var href:string = await page.evaluate(function(){
    return String(document.querySelector('a.message-anywhere-button')!.getAttribute('href'))
  })

  // If there isn't a previous conversation, we should create one
  if(href.includes('new?recipients')){
    // find recipient number
    let recipient:string = href.split(';')[0].split('=')[1].split('&')[0].split('%3A')[3].replace(')','')
    // send the request
    await page.evaluate(function(csrf,msg,recipient){
      fetch("https://www.linkedin.com/voyager/api/messaging/conversations?action=create", {
        "headers": {
          "accept": "application/vnd.linkedin.normalized+json+2.1",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/json; charset=UTF-8",
          "csrf-token": csrf
        },
        "body": "{\"keyVersion\":\"LEGACY_INBOX\",\"conversationCreate\":{\"eventCreate\":{\"value\":{\"com.linkedin.voyager.messaging.create.MessageCreate\":{\"attributedBody\":{\"text\":\""+msg+"\",\"attributes\":[]},\"attachments\":[]}}},\"recipients\":[\""+recipient+"\"],\"subtype\":\"MEMBER_TO_MEMBER\"}}",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
      })
    },csrf,msg,recipient)
  }
  // If there is a previous conservation, just send a message in that conservation.
  else{
    // find recipient number
    let recipient:string = href.split('?')[0].split('/')[3]
    // send the request
    await page.evaluate(function(csrf:string,msg:string,recipient:string){
      fetch("https://www.linkedin.com/voyager/api/messaging/conversations/"+recipient+"/events?action=create", {
        "headers": {
          "accept": "application/vnd.linkedin.normalized+json+2.1",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/json; charset=UTF-8",
          "csrf-token": csrf,
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
        },
        "body": "{\"eventCreate\":{\"value\":{\"com.linkedin.voyager.messaging.create.MessageCreate\":{\"attributedBody\":{\"text\":\""+msg+"\",\"attributes\":[]},\"attachments\":[]}}},\"dedupeByClientGeneratedToken\":false}",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
      })
    },csrf,msg,recipient)
  }

}

let url = new URL('url here')
let li_at:string = 'put your li_at cookie value here'
let msg:string = 'Hey I sent this message from my linkedin bot'

send_message_to_user(li_at,url,msg)