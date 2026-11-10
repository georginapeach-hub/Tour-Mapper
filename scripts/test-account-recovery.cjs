const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const els=new Map(),element=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',disabled:false,onclick(){}});return els.get(id)};
let emailCalls=0,passwordCalls=0;
const mock={auth:{resetPasswordForEmail:async(email,options)=>{emailCalls++;assert.equal(email,'owner@example.org');assert.equal(options.redirectTo,'https://example.org/Tour-Mapper/');return{error:null}},updateUser:async()=>{passwordCalls++;return{error:null}},getSession:async()=>({data:{session:null}})}};
const ctx={$:element,window:{addEventListener(){}},location:{origin:'https://example.org',pathname:'/Tour-Mapper/'},modal(){},esc:x=>String(x),toast(){},mock};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/cloud.js','utf8'),ctx);vm.runInContext('cloudClient=mock;showCloud=async()=>{};',ctx);
(async()=>{
 ctx.showForgotAccountPassword();element('#recoveryEmail').value='not-an-email';await element('#requestRecovery').onclick();assert.equal(emailCalls,0);
 element('#recoveryEmail').value='owner@example.org';await element('#requestRecovery').onclick();assert.equal(emailCalls,1);assert(element('#recoveryMessage').textContent.includes('If an account'));
 ctx.showNewAccountPassword();element('#newAccountPassword').value='sample-test-only';element('#confirmAccountPassword').value='different';await element('#saveAccountPassword').onclick();assert.equal(passwordCalls,0);
 element('#confirmAccountPassword').value='sample-test-only';await element('#saveAccountPassword').onclick();assert.equal(passwordCalls,1);
 console.log('Passed account recovery: invalid email and mismatched passwords rejected, correct redirect, neutral response and mocked password update. No real emails sent or credentials changed.');
})().catch(e=>{console.error(e);process.exitCode=1});
