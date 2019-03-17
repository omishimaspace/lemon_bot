'use strict';

const aws = require('aws-sdk');
const axios = require('axios');
const fs = require('fs');
const channelAccessToken = process.env.CHANNEL_ACCES_TOKEN;
const menuUrl = 'https://api.line.me/v2/bot/richmenu';
const userUrl = 'https://api.line.me/v2/bot/user/all/richmenu';
const docClient = new aws.DynamoDB.DocumentClient({region: 'ap-northeast-1'});
const tableName = 'line-context';

// AWS Lambda から呼び出される処理
exports.handler = async (event, context, callback) => {
  const header = {
    headers: {
      Authorization: 'Bearer ' + channelAccessToken
    }
  };

  const menu = {
    size: {
      width: 2500,
      height: 1686
    },
    selected: true,
    name: 'ズボラメニュー',
    chatBarText: 'タップしてズボラしよう！',
    areas: [
      {
        bounds: {
          x: 0, y: 843,
          width: 833, height: 843
        },
        action: {
          type: 'postback',
          data: 'food'
        }
      },
      {
        bounds: {
          x: 833, y: 843,
          width: 833, height: 843
        },
        action: {
          type: 'postback',
          data: 'category'
        }
      },
      {
        bounds: {
          x: 1666, y: 843,
          width: 833, height: 843
        },
        action: {
          type: 'postback',
          data: 'times'
        }
      },
    ]
  };

  try {
    let query = {
      TableName: tableName,
      Key: { userId: 'all' }
    };
    let response = null;
    let data = await docClient.get(query).promise();
    console.log(data);
    if (data && data.Item) {
      try {
        response = await axios.delete(userUrl, header);
        console.log(response.data);
  
        response = await axios.delete(menuUrl + '/' + data.Item.menuId, header);
        console.log(response.data);
      } catch (err) {
        console.log('Failed to delete menu: ' + data.Item.menuId);
      }
    }

    response = await axios.post(menuUrl, menu, header);
    console.log(response.data);
    const id = response.data.richMenuId;

    let item = {
      userId: 'all',
      timestamp: (new Date()).getTime(),
      menuId: id,
    };
    let payload = {
      TableName: tableName,
      Item: item
    };  
    response = await docClient.put(payload).promise();
    console.log(response);
    
    const image = fs.readFileSync('designs/line_menu.png');
    header.headers['Content-Type'] = 'image/png';
    response = await axios.post(menuUrl + '/' + id + '/content', image, header);
    console.log(response.data);

    header.headers['Content-Type'] = 'application/json';
    response = await axios.post(userUrl + '/' + id, {}, header);
    console.log(response.data);
  } catch (err) {
    console.log(err);
    console.log('Error!!');
  }

  callback(null, { statusCode: 200 });
}