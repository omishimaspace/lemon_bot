'use strict';

const aws = require('aws-sdk');
const axios = require('axios');
const line = require('@line/bot-sdk');
const channelAccessToken = process.env.CHANNEL_ACCES_TOKEN;
const lineClient = new line.Client({channelAccessToken: channelAccessToken});
const docClient = new aws.DynamoDB.DocumentClient({region: 'ap-northeast-1'});

const scenarioIdMind = 1;
const scenarioIdTobishimaNow = 2;
const scenarioIdDrone = 3;

const tableName = 'line-context';

const lineUserUrl = 'https://api.line.me/v2/bot/user'
const chefsUrl = 'https://zubora.herokuapp.com/api/v1/chefs'

const msg = [
  'おなかすいたーーー！！',
  'ねむい。。。',
  'うふふ',
  '元気だよ',
  'あっ！',
  'んーー',
];

const questions = {
  food: {
    scenario: scenarioIdMind,
    message: {
      type: 'text',
      text: 'れもんの気持ちを教えて',
    }
  },
  tobishima: {
    scenario: scenarioIdTobishimaNow,
    message: {
      type: 'text',
      text: 'いまのとびしまを見せて',
    }
  },
  drone: {
    scenario: scenarioIdDrone,
    message: {
      type: 'video',
      originalContentUrl: 'https://www.youtube.com/watch?v=d3XsUTC9LO4&feature=youtu.be&fbclid=IwAR2upsb-LguxnPX0Wf3yYm68ESgP17vHUf3TOiVrMpe2jaVDpuo27BIkEwo',
      previewImageUrl: ''
    }
  },
}

const setState = (params) => {
  let item = {
    userId: params.userId,
    timestamp: params.timestamp,
  }
  if (params.scenario) { item['scenario'] = params.scenario; }
  if (params.menuId) { item['menuId'] = params.menuId; }
  if (params.mind) { item['mind'] = params.mind; }
  if (params.tobishima) { item['tobishima'] = params.tobishima; }
  if (params.drone) { item['drone'] = params.drone; }

  let payload = {
    TableName: tableName,
    Item: item
  };

  docClient.put(payload, (err, data) => {
    if (err) {
      console.log(err);
    } else {
      console.log(data);
    }
  });
}

const getState = async (userId) => {
  let query = {
    TableName: tableName,
    Key: {
      userId: userId
    }
  };

  let data = null;
  try {
    data = await docClient.get(query).promise();
  } catch (err) {
    console.log(err);
  }
  return data;
}

const getMenuId = async (userId) => {
  const header = {
    headers: {
      Authorization: 'Bearer ' + channelAccessToken
    }
  };
  console.log(lineUserUrl + '/' + userId + '/richmenu');
  try {
    const response = await axios.get(lineUserUrl + '/' + userId + '/richmenu', header);
    console.log(response);
    return response.data;
  } catch (err) {
    if (err.response.status = 404) {
      // ユーザーのメニューが存在しない場合
      console.log('This user has no menu...');
    } else {
      console.log(err);
      console.log('Error!!');
      return null;
    }
  }
}

const setMenuOff = (userId) => {

}

const search = async (params) => {
  let url = chefsUrl + '?';
  url += (params && params.mind) ? 'mind=' + encodeURIComponent(params.mind) : '';
  url += (params && params.tobishima) ? 'tobishima=' + params.tobishima : '';
  url += (params && params.drone) ? 'drone=' + params.drone : '';

  const response = await axios.get(url);
  if (response.status !== 200) {
    console.log('Error!!');
    return null;
  }
  return response.data;
}

const getAnswer = (result) => {
  let recipe = result[0];
  return [
    {
      type: 'template',
      altText: recipe.name,
      template: {
        type: 'image_carousel',
        columns: [
          {
            imageUrl: recipe.photo_url,
            action: {
              type: 'uri',
              label: 'レシピを見る',
              uri: recipe.url
            }
          },
        ],
      },
    },
    {
      type: 'template',
      altText: '検索結果',
      template: {
        type: 'confirm',
        actions: [
          {
            type: 'uri',
            label: 'はい',
            uri: recipe.url
          },
          {
            type: 'message',
            label: 'いいえ',
            text: 'いいえ'
          }
        ],
        text: recipe.name + '\nが見つかりました！\n\nズボラスコアは【 ' + recipe.score + ' 】です。\n\nこのズボラ飯を作りますか？'
      }
    },
  ]
}

// AWS Lambda から呼び出される処理
exports.handler = (event, context, callback) => {
  console.log(event);
  const body = JSON.parse(event.body);

  // Response
  let response = { statusCode: 200 };

  body.events.some(async (lineEvent) => {
    let question = null;
    let answer = null;
    if (lineEvent.type === 'postback' && lineEvent.postback && lineEvent.postback.data) {
      if (lineEvent.postback.data === 'mind') {
        question = questions.mind;
      } else if (lineEvent.postback.data === 'tobishima') {
        question = questions.tobishima;
      } else if (lineEvent.postback.data === 'drone') {
        question = questions.drone;
      }
      if (question) {
        console.log(lineEvent.replyToken);
        console.log(question);
        let menuId = await getMenuId(lineEvent.source.userId);
        await setState({
          userId: lineEvent.source.userId,
          timestamp: lineEvent.timestamp,
          scenario: question.scenario,
          menuId: menuId,
        });
        await lineClient.replyMessage(lineEvent.replyToken, question.message);
        await setMenuOff(lineEvent.source.userId);
        return true;
      }
    } else if (lineEvent.type === 'message' && lineEvent.message) {
      //シナリオから処理を選ぶ
      let state = await getState(lineEvent.source.userId);
      if (state) {
        console.log('Current state is: ' + JSON.stringify(state));
        if (state.Item.scenario) {
          if (state.Item.scenario === scenarioIdMind) {
            let arrayIndex = Math.floor(Math.random() * arrayData.length);
            answer = msg[arrayIndex];
          } else {
            let number = lineEvent.message.text * 1;
            if (number > 0) {
              answer = {
                type: 'text',
                text: '探しています',
              };
            } else {
              answer = {
                type: 'text',
                text: '数字で入力してください',
              };
            }
          }
        }
      }
      if (answer) {
        console.log(lineEvent.replyToken);
        console.log(answer);
        await lineClient.replyMessage(lineEvent.replyToken, answer);
        return true;
      }
    }
  });

  callback(null, response);
}
