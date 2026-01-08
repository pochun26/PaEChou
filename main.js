const gids = [23945032, 50201461, 1635616029];
const sheetId = '1aeKhOsSwHf5mZ5lA0nQuTppWUdiGcqOXoYmHV2KXL8s';
// Google Sheets CSV 導出 URL 格式
function getCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

// 解析 CSV 字符串（有表头）
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
}

// 解析 CSV 行（处理引号内的逗号）
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ''));
  
  return values;
}

// 解析正确答案 CSV（无表头，格式：阶段,选项）
function parseAnswers(csvText) {
  const lines = csvText.trim().split('\n');
  const answers = {};
  
  for (const line of lines) {
    const values = parseCSVLine(line);
    if (values.length >= 2) {
      const stage = values[0]; // 阶段名称（八強、四強、冠軍）
      const options = parseOptions(values[1]); // 选项列表
      answers[stage] = options;
    }
  }
  
  return answers;
}

// 解析选项字符串，提取选项数组
function parseOptions(optionsStr) {
  if (!optionsStr) return [];
  return optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt);
}

// 计算两个选项数组的交集数量
function countMatches(predicted, correct) {
  const predictedSet = new Set(predicted);
  const correctSet = new Set(correct);
  let matches = 0;
  for (const option of predictedSet) {
    if (correctSet.has(option)) {
      matches++;
    }
  }
  return matches;
}

// 将时间字符串转换为时间戳（用于排序）
function parseTimestamp(timestampStr) {
  if (!timestampStr) return 0;
  // 格式: "12/26/2025 15:43:57"
  const date = new Date(timestampStr);
  return date.getTime();
}

// 格式化 Email，去掉 @ 之后的部分
function formatEmail(email) {
  if (!email) return '';
  const atIndex = email.indexOf('@');
  return atIndex > 0 ? email.substring(0, atIndex) : email;
}

// 获取所有 gid 的数据
Promise.all(
  gids.map(gid => {
    const url = getCsvUrl(gid);
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(csv => ({ gid, csv, success: true }))
      .catch(err => ({ gid, error: err.message, success: false }));
  })
)
  .then(results => {
    console.log('所有結果:', results);
    
    // 找出正确答案（GID 1635616029）
    const answerResult = results.find(r => r.gid === 1635616029);
    if (!answerResult || !answerResult.success) {
      throw new Error('無法獲取正確答案');
    }
    
    // 解析正确答案（无表头格式）
    const answers = parseAnswers(answerResult.csv);
    console.log('比賽結果:', answers);
    
    // 找出预测数据
    const predictionGids = {
      23945032: ['八強'],
      50201461: ['四強', '冠軍']
    };
    
    // 存储每个人的预测和分数
    const userScores = {};
    
    // 处理每个预测阶段
    Object.entries(predictionGids).forEach(([gid, stages]) => {
      const result = results.find(r => r.gid === parseInt(gid));
      if (!result || !result.success) {
        console.warn(`無法獲取 GID ${gid} 預測數據`);
        return;
      }
      
      const predictions = parseCSV(result.csv);
      
      // 处理该 gid 的每个阶段
      stages.forEach(stage => {
        const correctOptions = answers[stage] || [];
        
        predictions.forEach(row => {
          const email = row['Email Address'];
          const timestamp = row['Timestamp'];
          const predictedOptions = parseOptions(row[stage]);
          
          if (!userScores[email]) {
            userScores[email] = {
              email,
              score: 0,
              totalTimestamp: 0
            };
          }
          
          // 计算匹配数量
          const matches = countMatches(predictedOptions, correctOptions);
          userScores[email].score += matches;
          
          // 累加时间戳（只累加一次，使用第一次的时间戳）
          if (userScores[email].totalTimestamp === 0) {
            userScores[email].totalTimestamp = parseTimestamp(timestamp);
          }
        });
      });
    });
    
    // 转换为数组并排序
    const leaderboard = Object.values(userScores).sort((a, b) => {
      // 先按分数降序
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // 同分则按时间戳升序（越早越好）
      return a.totalTimestamp - b.totalTimestamp;
    });
    
    // 显示正确答案
    let answersHTML = '<div class="answers-section"><h2>📋 比賽結果</h2><div class="answers-grid">';
    Object.entries(answers).forEach(([stage, options]) => {
      answersHTML += `
        <div class="answer-item">
          <div class="stage">${stage}</div>
          <div class="options">${options.join('<br>')}</div>
        </div>
      `;
    });
    answersHTML += '</div></div>';
    
    // 显示排行榜
    let leaderboardHTML = '<div class="leaderboard-section"><h2>🏅 排行榜</h2><div class="leaderboard"><table><thead><tr><th>排名</th><th>分數</th><th>球探</th></tr></thead><tbody>';
    
    leaderboard.forEach((user, index) => {
      const rank = index + 1;
      const rankClass = rank === 1 ? 'first' : rank === 2 ? 'second' : rank === 3 ? 'third' : '';
      const username = formatEmail(user.email);
      
      leaderboardHTML += `
        <tr>
          <td class="rank ${rankClass}">${rank}</td>
          <td class="score">${user.score}</td>
          <td class="username">${username}</td>
        </tr>
      `;
    });
    
    leaderboardHTML += '</tbody></table></div></div>';
    
    document.getElementById('output').innerHTML = answersHTML + leaderboardHTML;
  })
  .catch(err => {
    console.error('整體錯誤:', err);
    document.getElementById('output').innerHTML = `<div class="error">❌ 錯誤: ${err.message}</div>`;
  });
