export default function Login() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FA812F]/5 text-white font-display">
      <h1 className="text-4xl mb-8 text-[#FA812F]">Welcome Back</h1>
      <form className="flex flex-col gap-4 bg-[#FFEDC5]/30 p-8 rounded-3xl backdrop-blur-md border border-[#FFEDC5]/50">
        <input
          type="email"
          placeholder="Email"
          className="bg-transparent border border-[#FFEDC5]/60 rounded-xl px-4 py-3 text-white placeholder-white/70 focus:border-[#FA812F] focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          className="bg-transparent border border-[#FFEDC5]/60 rounded-xl px-4 py-3 text-white placeholder-white/70 focus:border-[#FA812F] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-2xl bg-[#FA812F] border border-[#FA812F]/60 px-6 py-3 text-lg font-display text-white hover:translate-y-[1px] transition-all duration-200"
        >
          Login
        </button>
      </form>
    </div>
  );
}
