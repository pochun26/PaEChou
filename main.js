const gids = [23945032, 50201461, 1635616029];
const sheetId = '1aeKhOsSwHf5mZ5lA0nQuTppWUdiGcqOXoYmHV2KXL8s';
// 隱藏在標題上的表單連結（請填入實際表單 URL）
const hiddenFormUrl = 'https://docs.google.com/spreadsheets/d/1aeKhOsSwHf5mZ5lA0nQuTppWUdiGcqOXoYmHV2KXL8s/edit?gid=1635616029#gid=1635616029';
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
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

// 將時間戳轉換為可讀格式
function formatDisplayTimestamp(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '-';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
}

// 格式化 Email，去掉 @ 之后的部分
function formatEmail(email) {
  if (!email) return '';
  const atIndex = email.indexOf('@');
  return atIndex > 0 ? email.substring(0, atIndex) : email;
}

// 名稱開頭改為大寫
function capitalizeName(name) {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// 套用頁面進場與徽章動畫
function applyAnimations() {
  const stageCards = document.querySelectorAll('.stage-card');
  stageCards.forEach((card, idx) => {
    card.classList.add('pop-in');
    card.style.animation = `popIn 0.55s ease ${idx * 0.08}s forwards`;
  });

  const tableRows = document.querySelectorAll('.table-row');
  tableRows.forEach((row, idx) => {
    row.classList.add('stagger-row');
    row.style.animation = `fadeInUp 0.45s ease ${idx * 0.05}s forwards`;
  });

  const medalIcons = document.querySelectorAll('.medal-icon');
  medalIcons.forEach((icon, idx) => {
    icon.classList.add('medal-glow');
    icon.style.animationDelay = `${idx * 0.1}s`;
  });
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
    const allTimestamps = [];
    
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
              timeScore: Number.POSITIVE_INFINITY,
              countedGids: new Set(),
              rawTimestamps: []
            };
          }

          // 紀錄每個 gid 的提交時間（同分時以所有提交時間加總排序）
          const parsedTimestamp = parseTimestamp(timestamp);
          const gidKey = String(gid);
          if (parsedTimestamp > 0 && !userScores[email].countedGids.has(gidKey)) {
            userScores[email].countedGids.add(gidKey);
            userScores[email].rawTimestamps.push({
              gid: gidKey,
              value: parsedTimestamp,
              display: formatDisplayTimestamp(parsedTimestamp)
            });
            allTimestamps.push(parsedTimestamp);
          }
          
          // 计算匹配数量
          const matches = countMatches(predictedOptions, correctOptions);
          userScores[email].score += matches;
        });
      });
    });
    
    // 以最早的提交時間為基準，將所有提交時間平移後加總，再轉為加分（越早越高）
    const baselineTimestamp = allTimestamps.length ? Math.min(...allTimestamps) : 0;
    const validTimeScores = [];
    Object.values(userScores).forEach(user => {
      if (baselineTimestamp === 0 || user.rawTimestamps.length === 0) {
        user.timeScore = Number.POSITIVE_INFINITY;
        return;
      }
      const timeScore = user.rawTimestamps.reduce(
        (sum, ts) => sum + (ts.value - baselineTimestamp),
        0
      );
      user.timeScore = timeScore;
      validTimeScores.push(timeScore);
    });

    const maxTimeScore = validTimeScores.length ? Math.max(...validTimeScores) : 0;
    Object.values(userScores).forEach(user => {
      if (user.timeScore === Number.POSITIVE_INFINITY || maxTimeScore === 0) {
        user.timePriority = Number.NEGATIVE_INFINITY;
        user.timePriorityDisplay = '-';
        return;
      }
      const timePriority = maxTimeScore - user.timeScore;
      user.timePriority = timePriority;
      const timePriorityMinutes = parseInt(timePriority / 1000);
      user.timePriorityDisplay = `${timePriorityMinutes}`;
    });

    // 转换为数组并排序
    const leaderboard = Object.values(userScores).sort((a, b) => {
      // 先按分数降序
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // 同分則按時間加分（越早越高）
      const timeA = a.timePriority ?? Number.NEGATIVE_INFINITY;
      const timeB = b.timePriority ?? Number.NEGATIVE_INFINITY;
      return timeB - timeA;
    });
    
    const resultTitle = hiddenFormUrl
      ? `<a href="${hiddenFormUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit; cursor: pointer;">比賽結果</a>`
      : '比賽結果';

    // 显示正确答案
    let answersHTML = `
      <div class="glass-effect rounded-2xl p-6 md:p-8 shadow-2xl card-hover fade-in">
        <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-6 flex items-center">
          <span class="mr-3">📋</span> ${resultTitle}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
    `;
    
    Object.entries(answers).forEach(([stage, options]) => {
      const stageClass = stage.includes('八') ? 'eight' : stage.includes('四') ? 'four' : 'champion';
      answersHTML += `
        <div class="stage-card ${stageClass} rounded-lg p-5 card-hover">
          <div class="font-bold text-lg md:text-xl mb-3 text-gray-700">${stage}</div>
          <div class="text-gray-600 space-y-1 text-sm md:text-base">
            ${options.map(opt => `<div class="flex items-center"><span class="mr-2">✓</span>${opt}</div>`).join('')}
          </div>
        </div>
      `;
    });
    answersHTML += '</div></div>';
    
    // 显示排行榜
    let leaderboardHTML = `
      <div class="glass-effect rounded-2xl p-6 md:p-8 shadow-2xl card-hover fade-in">
        <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-6 flex items-center">
          <span class="mr-3">🏅</span> 預測排行榜
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <th class="px-4 md:px-6 py-4 text-left rounded-tl-lg font-semibold">排名</th>
                <th class="px-4 md:px-6 py-4 text-left font-semibold">分數</th>
                <th class="px-4 md:px-6 py-4 text-left font-semibold">手速</th>
                <th class="px-4 md:px-6 py-4 text-left rounded-tr-lg font-semibold">球探</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    leaderboard.forEach((user, index) => {
      const rank = index + 1;
      const rankBadgeClass = rank === 1 ? 'first' : rank === 2 ? 'second' : rank === 3 ? 'third' : 'other';
      const username = capitalizeName(formatEmail(user.email));
      const submissionTime = user.timePriorityDisplay;
      
      // 奖牌图标
      let medalIcon = '';
      if (rank === 1) {
        medalIcon = '<span class="medal-icon text-2xl md:text-3xl mr-2">🥇</span>';
      } else if (rank === 2) {
        medalIcon = '<span class="medal-icon text-2xl md:text-3xl mr-2">🥈</span>';
      } else if (rank === 3) {
        medalIcon = '<span class="medal-icon text-2xl md:text-3xl mr-2">🥉</span>';
      }
      
      leaderboardHTML += `
        <tr class="table-row border-b border-gray-200">
          <td class="px-4 md:px-6 py-4">
            <span class="rank-badge ${rankBadgeClass}">${rank}</span>
          </td>
          <td class="px-4 md:px-6 py-4">
            <span class="score-badge">${user.score} 分</span>
          </td>
          <td class="px-4 md:px-6 py-4 text-gray-600 text-sm md:text-base">
            ${submissionTime}
          </td>
          <td class="px-4 md:px-6 py-4 font-medium text-gray-700 text-lg">
            <div class="flex items-center">
              ${medalIcon}
              <span>${username}</span>
            </div>
          </td>
        </tr>
      `;
    });
    
    leaderboardHTML += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('output').innerHTML = answersHTML + leaderboardHTML;
    applyAnimations();
  })
  .catch(err => {
    console.error('整體錯誤:', err);
    document.getElementById('output').innerHTML = `
      <div class="glass-effect rounded-2xl p-6 shadow-2xl fade-in">
        <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div class="flex items-center">
            <span class="text-red-500 text-2xl mr-3">❌</span>
            <div>
              <p class="text-red-800 font-semibold text-lg">發生錯誤</p>
              <p class="text-red-600 mt-1">${err.message}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  });
