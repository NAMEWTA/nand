/** A suspended child joins a kill-on-close job before any user code can create descendants. */
const supervisor = String.raw`
using System;
using System.Text;
using System.Runtime.InteropServices;
public class NandPrecheckJob {
 [StructLayout(LayoutKind.Sequential)] struct Basic { public long a,b; public uint flags; public UIntPtr c,d; public uint e; public UIntPtr f; public uint g,h; }
 [StructLayout(LayoutKind.Sequential)] struct IO { public ulong a,b,c,d,e,f; }
 [StructLayout(LayoutKind.Sequential)] struct Limits { public Basic basic; public IO io; public UIntPtr a,b,c,d; }
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup { public int size; public string reserved,desktop,title; public int x,y,w,h,cx,cy,fill,flags; public short show,reserved2; public IntPtr reserved3,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct Info { public IntPtr process,thread; public int pid,tid; }
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a,string b);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref Limits info,int size);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out Info info);
 [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
 [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static int Run(string command,string cwd) {
  IntPtr job=CreateJobObject(IntPtr.Zero,null); Info child=new Info();
  try {
   if(job==IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
   Limits limits=new Limits(); limits.basic.flags=0x2000;
   if(!SetInformationJobObject(job,9,ref limits,Marshal.SizeOf(limits))) throw new System.ComponentModel.Win32Exception();
   Startup startup=new Startup(); startup.size=Marshal.SizeOf(startup); startup.flags=0x100;
   startup.input=GetStdHandle(-10); startup.output=GetStdHandle(-11); startup.error=GetStdHandle(-12);
   if(!CreateProcess(null,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,true,0x08000004,IntPtr.Zero,cwd,ref startup,out child)) throw new System.ComponentModel.Win32Exception();
   if(!AssignProcessToJobObject(job,child.process)) throw new System.ComponentModel.Win32Exception();
   if(ResumeThread(child.thread)==0xffffffff) throw new System.ComponentModel.Win32Exception();
   WaitForSingleObject(child.process,0xffffffff); uint code;
   if(!GetExitCodeProcess(child.process,out code)) throw new System.ComponentModel.Win32Exception();
   return (int)code;
  } finally {
   // Includes normal exit, failure before assignment, cancellation and supervisor termination.
   if(child.process!=IntPtr.Zero) { TerminateProcess(child.process,1); CloseHandle(child.process); }
   if(child.thread!=IntPtr.Zero) CloseHandle(child.thread);
   if(job!=IntPtr.Zero) CloseHandle(job);
  }
 }
}
`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
export function windowsPrecheckCommand(file: string, args: string[], cwd: string) {
	// Windows CommandLineToArgvW quoting, including trailing backslashes before the closing quote.
	const quote = (value: string) => `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/\\+$/g, '$&$&')}"`;
	const command = [file, ...args].map(quote).join(' ');
	const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition ${literal(supervisor)}; exit [NandPrecheckJob]::Run(${literal(command)},${literal(cwd)})`;
	return [
		'-NoLogo',
		'-NoProfile',
		'-NonInteractive',
		'-EncodedCommand',
		Buffer.from(script, 'utf16le').toString('base64'),
	];
}
