// Headless oracle for synthetic inputs only. Compile with the pinned, unchanged
// Scala 2.12.13 sources in this directory; never instantiate the legacy GUI.
import java.util.Base64
import passwordManagerMain.{PasswordGenerator, Record}

object Oracle {
  def main(args: Array[String]): Unit = {
    require(java.nio.charset.Charset.defaultCharset().name() == "UTF-8")
    val decode = (s: String) => new String(Base64.getDecoder.decode(s), "UTF-8")
    scala.io.Source.stdin.getLines().foreach { line =>
      val fields = line.split("\t", -1)
      val master = decode(fields(0))
      val salt = decode(fields(1))
      val symbols = decode(fields(4))
      val record = new Record(Seq("synthetic", "", fields(2), fields(3),
        symbols.replace(" ", "\\S").replace(",", "\\C"), fields(5), salt).mkString(","))
      try {
        val result = PasswordGenerator.generate(master, record, salt)
        println(Base64.getEncoder.encodeToString(result.getBytes("UTF-8")))
      } catch {
        case e: Exception if e.getMessage.startsWith("パスワードが生成できなかったよ") => println("EXHAUSTED")
      }
    }
  }
}
