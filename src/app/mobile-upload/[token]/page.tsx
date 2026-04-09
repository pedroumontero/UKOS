import { MobileInventoryUploadClient } from "./mobile-upload-client";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function MobileInventoryUploadPage({ params }: PageProps) {
  const { token } = await params;
  return <MobileInventoryUploadClient token={token} />;
}
