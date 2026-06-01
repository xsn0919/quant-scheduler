import express from 'express';
import schedule from 'node-schedule';
import puppeteer from 'puppeteer';

// 配置参数（请务必将 '1234' 替换成你的真实密钥）
const CRON_SECRET_KEY = '1234';
const TARGET_URL = 'https://quant.ccccocccc.cc/cron_trigger.php';

// 创建 Express 服务 (用于 Koyeb 健康检查)
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`健康检查服务运行在端口 ${PORT}`);
});

// 时间工具：获取北京时间
function getBeijingTime() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return {
    year: beijingTime.getUTCFullYear(),
    month: beijingTime.getUTCMonth() + 1,
    day: beijingTime.getUTCDate(),
    hour: beijingTime.getUTCHours(),
    minute: beijingTime.getUTCMinutes(),
    dayOfWeek: beijingTime.getUTCDay() === 0 ? 7 : beijingTime.getUTCDay(),
  };
}

// 核心任务执行函数
async function executeTask(taskName) {
  const url = `${TARGET_URL}?key=${CRON_SECRET_KEY}&task=${taskName}&force=1`;
  console.log(`[执行] ${taskName}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    const body = await page.evaluate(() => document.body.innerText);
    const success = body.includes('OK') || body.includes('成功');
    console.log(`[结果] ${taskName} ${success ? '成功' : '失败'}`);
    await page.close();
    return { task: taskName, success, response: body };
  } catch (err) {
    console.error(`[错误] ${taskName} 执行异常:`, err.message);
    return { task: taskName, success: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

// 调度主逻辑 (每分钟触发)
async function schedulerJob() {
  const { hour, minute, dayOfMonth, month, dayOfWeek, year } = getBeijingTime();
  const totalMinutes = hour * 60 + minute;
  console.log(`\n======= 调度检查: ${year}-${month}-${dayOfMonth} ${hour}:${minute} =======`);
  
  const tasksToRun = [];
  
  // 静态任务映射表 (分钟 小时 日 月 周)
  const staticTasks = {
    '31 1 * * *': 'daily_sync',
    '36 1 * * *': 'daily_sync_2',
    '41 1 * * *': 'daily_sync_3',
    '46 1 * * *': 'daily_sync_3',
    '51 1 * * *': 'sync_etf_daily',
    '56 1 * * *': 'daily_sync_list',
    '1 2 * * *': 'factor_calc_1',
    '6 2 * * *': 'factor_calc_2',
    '11 2 * * *': 'factor_calc_3',
    '16 2 * * *': 'factor_calc_4',
    '21 2 * * *': 'factor_calc_5',
    '26 2 * * *': 'factor_calc_6',
    '0 8 * * *': 'morning_pick_1a',
    '5 8 * * *': 'morning_pick_1b',
    '10 8 * * *': 'morning_pick_2a',
    '15 8 * * *': 'morning_pick_2b',
    '20 8 * * *': 'morning_pick_3',
    '25 8 * * *': 'morning_pick_1c',
    '20 9 * * *': 'morning_analysis_trigger',
    '21 9 * * *': 'morning_analysis_worker',
    '30 9 * * *': 'enhance_pick_worker',
    '0 4 1 * *': 'sync_names',
    '0 5 1 * *': 'update_weights',
    '30 4 * * *': 'historical_sync',
  };
  
  function   函数 matchCron(cronExpr) {
    const   常量 [cMin, cHour, cDay, cMon, cDow] = cronExpr.split(' ');
    if   如果 (cMin !== '*' && parseInt(cMin) !== minute   一分钟) return false;
    if   如果 (cHour !== '*' && parseInt(cHour) !== hour   小时) return false;
    if   如果 (cDay !== '*' && parseInt(cDay) !== dayOfMonth) return false;
    if   如果 (cMon !== '*' && parseInt(cMon) !== month) return false;
    if   如果 (cDow !== '*' && parseInt(cDow) !== dayOfWeek) return false;
    return true;
  }
  
  for   为 (const   常量 [cron, task   任务] of Object.entries(staticTasks)) {
    if   如果 (matchCron(cron)) tasksToRun.push(task);
  }
  
  // AI评分Worker (02:31-04:21 每10分钟)
  if   如果 (hour   小时 >= 2 && hour   小时 <= 4 && totalMinutes >= 151 && totalMinutes <= 261 && minute   一分钟 % 10 === 1) {
    tasksToRun.push('ai_score_worker');
  }
  
  // 盘中监控 (周一至五 9:25-15:10 每15分钟)
  const   常量 isWeekday = (dayOfWeek >= 1 && dayOfWeek <= 5);
  if   如果 (isWeekday && totalMinutes >= 565 && totalMinutes <= 910 && minute   一分钟 % 15 === 0) {
    tasksToRun.push('intraday_30m');
  }
  
  // 实时监控 (周一至五 9:28-15:05 每5分钟)
  if   如果 (isWeekday && totalMinutes >= 568 && totalMinutes <= 905 && minute   一分钟 % 5 === 0) {
    tasksToRun.push('realtime_monitor');
  }
  
  // NIM保活
  const   常量 isTrading = (isWeekday && totalMinutes >= 565 && totalMinutes <= 910);
  const   常量 isAIWorkerTime = (hour   小时 >= 2 && hour   小时 <= 4 && totalMinutes >= 151 && totalMinutes <= 261);
  if   如果 (!isAIWorkerTime) {
    if   如果 ((hour   小时 === 4 && minute   一分钟 === 0) || (hour   小时 === 8 && minute   一分钟 === 0)) tasksToRun.push('nim_keep_alive');
    if   如果 (isTrading && minute   一分钟 % 5 === 0) tasksToRun.push('nim_keep_alive');
    if   如果 (!isTrading && minute   一分钟 % 30 === 0) tasksToRun.push('nim_keep_alive');
  }
  
  const   常量 uniqueTasks = [...new   新 Set(tasksToRun)];
  if   如果 (uniqueTasks.length === 0) {
    console.log   日志('当前分钟无任务');
    return;
  }
  
  console.log   日志(`待执行任务: ${uniqueTasks.join(', ')}`);
  for   为 (const   常量 task of uniqueTasks) {
    await executeTask(task);
    await new   新 Promise   承诺(resolve => setTimeout(resolve, 1000));
  }
  console.log   日志('========== 本分钟调度完成 ==========\n');
}

// 每分钟执行一次
schedule.scheduleJob('* * * * *', () => {
  schedulerJob().catch(err => console.error('调度器异常:', err));
});

console.log   日志('调度器已启动，每分钟检查一次任务');
