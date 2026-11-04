import Image from "next/image";

export default function UserAvatar({ id, firstName, lastName = "", photoVersion, size = 40 }: {
  id: number; firstName: string; lastName?: string; photoVersion: string | null; size?: number;
}) {
  return <span className="user-avatar" style={{ width: size, height: size }} aria-hidden="true">
    {photoVersion ? <Image src={`/api/users/${id}/photo?v=${encodeURIComponent(photoVersion)}`} alt="" width={size} height={size} unoptimized /> : `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`}
  </span>;
}
