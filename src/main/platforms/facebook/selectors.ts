// Keep language-dependent Facebook locators together. Unknown UI fails closed.
export const labels = {
  account: /^(Account|Your profile|你的个人主页|账户|帐户|账号)$/i,
  profiles: /^(See all profiles|查看所有个人主页|查看所有主页|查看全部个人主页)$/i,
  switch: /^(Switch Now|Switch now|Switch|立即切换|切换)$/i,
  composer:
    /What's on your mind|Write something|在想什么|分享.*新鲜事|写点什么|发布新动态|你有什么想法/i,
  create: /^(Create post|创建帖子|发帖|发布帖子)$/i,
  post: /^(Post|Publish|发布|發佈|发帖)$/i,
  next: /^(Next|下一步|下一页)$/i,
  photo: /Photo\/video|照片\/视频|照片和视频|照片／视频/i,
  close: /^(Close|关闭|關閉)$/i,
  uploading: /Uploading|正在上传|上传中|正在处理|Processing/i,
};
