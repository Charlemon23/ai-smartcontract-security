export default function reentrancyRule({ file, source }) {
  const findings=[];const lines=source.split(/\\r?\\n/);let func=null;
  lines.forEach((ln,idx)=>{
    if (/function\s+\w+\s*\(/.test(ln)) {
    func = { start: idx + 1, ext: false, write: false };
}

    if(func){
      if(/\\.(call|delegatecall|send|transfer)\\s*\\{?value?/.test(ln)) func.ext=true;
      if(func.ext && /=\\s*.+balances/.test(ln)) func.write=true;
      if(/}/.test(ln)){ if(func.ext&&func.write) findings.push({rule:"REENTRANCY",severity:"HIGH",message:"External call before state update",location:`${file}:${func.start}-${idx+1}`}); func=null;}
    }
  });
  return findings;
}
